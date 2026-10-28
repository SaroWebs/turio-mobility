<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\TourBooking;
use App\Models\TourShare;
use App\Services\MtalkzSmsService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;

class TourShareController extends Controller
{
    public function invitations(Request $request)
    {
        $customer = $request->user();
        abort_unless($customer instanceof Customer && $customer->phone_verified_at, 403, 'Verify your mobile number to view invitations.');
        $shares = TourShare::where('phone', $this->phone($customer->phone))->whereNull('revoked_at')
            ->where('expires_at', '>', now())->with(['booking.tour', 'booking.schedule'])->latest()->get()
            ->filter(fn ($share) => $share->tripIsOpen())->map(fn ($share) => [
                'id' => $share->id, 'tour_title' => $share->booking->tour->title,
                'departure_date' => $share->booking->schedule->departure_date->toDateString(),
                'status' => $share->verified_at ? 'verified' : 'invited', 'expires_at' => $share->expires_at->toIso8601String(),
            ])->values();

        return response()->json(['data' => $shares])->header('Cache-Control', 'no-store');
    }

    private function owner(Request $request, TourBooking $booking): void
    {
        abort_unless($request->user() instanceof Customer && (int) $booking->customer_id === (int) $request->user()->id, 404);
    }

    private function phone(string $phone): string
    {
        $digits = preg_replace('/\D/', '', $phone);
        if (strlen($digits) === 12 && str_starts_with($digits, '91')) {
            $digits = substr($digits, 2);
        }
        abort_unless(preg_match('/^[6-9][0-9]{9}$/', $digits), 422, 'Enter a valid Indian mobile number.');

        return '+91'.$digits;
    }

    public function index(Request $request, TourBooking $booking)
    {
        $this->owner($request, $booking);

        return response()->json(['data' => TourShare::where('tour_booking_id', $booking->id)->latest()->get()->map(fn ($share) => [
            'id' => $share->id, 'name' => $share->name, 'phone' => '******'.substr($share->phone, -4),
            'status' => $share->revoked_at ? 'Stopped' : (! $share->tripIsOpen() ? 'Closed' : ($share->verified_at ? 'Verified' : ($share->expires_at->isPast() ? 'Expired' : 'Invited'))),
        ])]);
    }

    public function store(Request $request, TourBooking $booking)
    {
        $this->owner($request, $booking);
        $data = $request->validate(['name' => 'required|string|max:80', 'phone' => 'required|string|max:20']);
        $phone = $this->phone($data['phone']);

        return DB::transaction(function () use ($booking, $data, $phone) {
            $booking = TourBooking::lockForUpdate()->findOrFail($booking->id);
            $check = new TourShare;
            $check->setRelation('booking', $booking);
            abort_unless($check->tripIsOpen() && $booking->tour->is_active && $booking->schedule->departure_at?->isFuture(), 422, 'Sharing is available before your tour starts.');
            $active = TourShare::where('tour_booking_id', $booking->id)->whereNull('revoked_at')
                ->where(fn ($q) => $q->whereNotNull('verified_at')->orWhere('expires_at', '>', now()));
            abort_if((clone $active)->where('phone', $phone)->exists(), 422, 'This person already has an invitation. Stop sharing before inviting again.');
            abort_if($active->count() >= 5, 422, 'You can share with up to 5 people.');
            $token = Str::random(64);
            $share = TourShare::create([
                'tour_booking_id' => $booking->id, 'name' => $data['name'], 'phone' => $phone,
                'token_hash' => hash('sha256', $token), 'expires_at' => now()->addDay()->min($booking->schedule->departure_at),
            ]);

            return response()->json(['data' => ['id' => $share->id, 'token' => $token]], 201)->header('Cache-Control', 'no-store');
        });
    }

    public function revoke(Request $request, TourBooking $booking, TourShare $share)
    {
        $this->owner($request, $booking);
        abort_unless((int) $share->tour_booking_id === (int) $booking->id, 404);
        $share->update(['revoked_at' => now(), 'session_hash' => null, 'otp_hash' => null]);

        return response()->json(['success' => true]);
    }

    private function invitation(Request $request): TourShare
    {
        $data = $request->validate(['token' => 'required|string|size:64', 'phone' => 'required|string|max:20']);
        $share = TourShare::where('token_hash', hash('sha256', $data['token']))->lockForUpdate()->first();
        abort_unless($share && ! $share->revoked_at && ! $share->verified_at && $share->expires_at->isFuture()
            && hash_equals($share->phone, $this->phone($data['phone'])) && $share->tripIsOpen()
            && $share->booking->schedule->departure_at?->isFuture(), 404, 'This invitation is unavailable or has expired.');

        return $share;
    }

    public function sendOtp(Request $request, MtalkzSmsService $sms)
    {
        // Commit the challenge before SMS delivery. Never hold a database lock during a provider call.
        [$share, $code] = DB::transaction(function () use ($request) {
            $share = $this->invitation($request);
            abort_if($share->sent_at && $share->sent_at->gt(now()->subMinute()), 429, 'Please wait 60 seconds before requesting another OTP.');
            $key = 'tour-share-send:'.hash('sha256', $share->phone);
            abort_if(RateLimiter::tooManyAttempts($key, 5), 429, 'Please try again later.');
            RateLimiter::hit($key, 3600);
            $code = (string) random_int(100000, 999999);
            $share->update(['otp_hash' => Hash::make($code), 'otp_expires_at' => now()->addMinutes(5), 'sent_at' => now(), 'attempts' => 0]);

            return [$share, $code];
        });
        $sent = $sms->isConfigured() && $sms->send($share->phone, "Your Turiya Mobility verification code is: {$code}. Valid for 5 minutes.", config('services.mtalkz.templates.otp'));
        if (! $sent) {
            TourShare::whereKey($share->id)->where('otp_hash', $share->otp_hash)->update(['otp_hash' => null]);
            abort(503, 'OTP could not be sent. Please try again later.');
        }

        return response()->json(['success' => true, 'message' => 'OTP sent to the invited mobile number.']);
    }

    public function verify(Request $request)
    {
        $request->validate(['code' => 'required|digits:6']);

        // Return errors from the transaction so failed-attempt counters are committed.
        return DB::transaction(function () use ($request) {
            $share = $this->invitation($request);
            $key = 'tour-share-verify:'.hash('sha256', $share->phone);
            if (RateLimiter::tooManyAttempts($key, 10)) {
                return response()->json(['message' => 'Too many attempts. Please try again later.'], 429);
            }
            RateLimiter::hit($key, 3600);
            if (! $share->otp_hash || ! $share->otp_expires_at?->isFuture() || $share->attempts >= 5) {
                return response()->json(['message' => 'Request a new OTP to continue.'], 422);
            }
            if (! Hash::check($request->code, $share->otp_hash)) {
                $share->increment('attempts');

                return response()->json(['message' => 'The OTP is incorrect or has expired.'], $share->attempts >= 5 ? 429 : 422);
            }
            $session = Str::random(64);
            $share->update(['verified_at' => now(), 'otp_hash' => null, 'session_hash' => hash('sha256', $session),
                'session_expires_at' => $share->booking->schedule->sharingEndsAt()]);

            return response()->json(['data' => ['session' => $session]])->header('Cache-Control', 'no-store');
        });
    }

    public function show(Request $request)
    {
        $session = (string) $request->header('X-Tour-Share-Session');
        abort_unless(strlen($session) === 64, 404);
        $share = TourShare::where('session_hash', hash('sha256', $session))->first();
        abort_unless($share && ! $share->revoked_at && $share->verified_at && $share->session_expires_at?->isFuture() && $share->tripIsOpen(), 404, 'Shared access has ended.');
        $booking = $share->booking;

        // Explicit allowlist: never serialize a booking or owner resource to a recipient.
        return response()->json(['data' => [
            'title' => $booking->tour->title, 'status' => $booking->status,
            'travel_date' => $booking->travel_date->toDateString(),
            'pickup' => $booking->tour->start_location,
            'days' => $booking->tour->itineraries->map(fn ($day) => ['day' => $day->day_number, 'title' => $day->title, 'details' => $day->details]),
        ]])->header('Cache-Control', 'no-store, private');
    }
}
