<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SupportTicket;
use App\Services\InsurancePlanCatalog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SupportTicketController extends Controller
{
    public function index(Request $request)
    {
        $tickets = SupportTicket::query()
            ->whereMorphedTo('requester', $request->user())
            ->with(['messages' => fn ($query) => $query->where('is_internal', false)->oldest()])
            ->latest('last_message_at')
            ->get();

        return response()->json(['success' => true, 'data' => $tickets]);
    }

    public function store(Request $request, InsurancePlanCatalog $bookings)
    {
        $validated = $request->validate([
            'category' => 'required|in:general,account,payment,insurance,safety,accessibility,feedback,booking',
            'subject' => 'required|string|max:160',
            'message' => 'required|string|max:4000',
            'priority' => 'nullable|in:low,normal,high,urgent',
            'service_type' => 'nullable|required_with:booking_id|in:ride,tour,rental',
            'booking_id' => 'nullable|required_with:service_type|integer|min:1',
        ]);

        $booking = null;
        if (isset($validated['booking_id'])) {
            $booking = $bookings->customerBooking($validated['service_type'], $validated['booking_id'], $request->user()->id);
        }

        $ticket = DB::transaction(function () use ($request, $validated, $booking) {
            $ticket = SupportTicket::create([
                'ticket_number' => SupportTicket::generateNumber(),
                'requester_type' => $request->user()->getMorphClass(),
                'requester_id' => $request->user()->getKey(),
                'booking_type' => $booking?->getMorphClass(),
                'booking_id' => $booking?->getKey(),
                'category' => $validated['category'],
                'priority' => $validated['priority'] ?? 'normal',
                'status' => 'open',
                'subject' => $validated['subject'],
                'last_message_at' => now(),
            ]);
            $ticket->messages()->create([
                'author_type' => $request->user()->getMorphClass(),
                'author_id' => $request->user()->getKey(),
                'body' => $validated['message'],
            ]);

            return $ticket;
        });

        return response()->json(['success' => true, 'message' => 'Ticket created.', 'data' => $ticket->load('messages')], 201);
    }

    public function reply(Request $request, SupportTicket $ticket)
    {
        abort_unless($ticket->requester_type === $request->user()->getMorphClass() && $ticket->requester_id === $request->user()->getKey(), 403);
        abort_if(in_array($ticket->status, ['resolved', 'closed'], true), 409, 'Closed tickets cannot receive replies.');
        $validated = $request->validate(['message' => 'required|string|max:4000']);

        $message = $ticket->messages()->create([
            'author_type' => $request->user()->getMorphClass(),
            'author_id' => $request->user()->getKey(),
            'body' => $validated['message'],
        ]);
        $ticket->update(['status' => 'customer_reply', 'last_message_at' => now()]);

        return response()->json(['success' => true, 'data' => $message], 201);
    }
}
