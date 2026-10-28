<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\Tour;
use App\Models\TourInquiry;
use App\Models\TourSchedule;
use Illuminate\Validation\ValidationException;

class TourWaitlistService
{
    public function __construct(
        protected NotificationService $notificationService
    ) {}

    /**
     * Join waitlist for a specific tour or sold-out departure.
     */
    public function joinWaitlist(Customer $customer, array $data): TourInquiry
    {
        $tour = Tour::findOrFail($data['tour_id']);

        $schedule = null;
        if (! empty($data['tour_schedule_id'])) {
            $schedule = TourSchedule::where('tour_id', $tour->id)->findOrFail($data['tour_schedule_id']);
        }

        // Prevent duplicate pending waitlist for the same customer + schedule/tour
        $existing = TourInquiry::query()
            ->where('customer_id', $customer->id)
            ->where('tour_id', $tour->id)
            ->when($schedule, fn ($q) => $q->where('tour_schedule_id', $schedule->id))
            ->where('inquiry_type', TourInquiry::TYPE_SOLD_OUT_WAITLIST)
            ->where('status', TourInquiry::STATUS_PENDING)
            ->first();

        if ($existing) {
            throw ValidationException::withMessages([
                'tour_schedule_id' => ['You are already on the waitlist for this departure.'],
            ]);
        }

        $inquiry = TourInquiry::create([
            'customer_id' => $customer->id,
            'tour_id' => $tour->id,
            'tour_schedule_id' => $schedule?->id,
            'inquiry_type' => TourInquiry::TYPE_SOLD_OUT_WAITLIST,
            'status' => TourInquiry::STATUS_PENDING,
            'desired_date' => $schedule?->departure_date ?? ($data['desired_date'] ?? null),
            'number_of_guests' => (int) ($data['number_of_guests'] ?? 1),
            'customer_name' => $data['customer_name'] ?? $customer->name,
            'customer_phone' => $data['customer_phone'] ?? $customer->phone,
            'customer_email' => $data['customer_email'] ?? $customer->email,
            'special_requests' => $data['special_requests'] ?? null,
        ]);

        $this->sendWaitlistConfirmation($inquiry);

        return $inquiry;
    }

    /**
     * Submit a private tour inquiry.
     */
    public function requestPrivateTour(Customer $customer, array $data): TourInquiry
    {
        $tour = Tour::findOrFail($data['tour_id']);

        $inquiry = TourInquiry::create([
            'customer_id' => $customer->id,
            'tour_id' => $tour->id,
            'tour_schedule_id' => null,
            'inquiry_type' => TourInquiry::TYPE_PRIVATE_TOUR_REQUEST,
            'status' => TourInquiry::STATUS_PENDING,
            'desired_date' => $data['desired_date'] ?? null,
            'number_of_guests' => (int) ($data['number_of_guests'] ?? 1),
            'customer_name' => $data['customer_name'] ?? $customer->name,
            'customer_phone' => $data['customer_phone'] ?? $customer->phone,
            'customer_email' => $data['customer_email'] ?? $customer->email,
            'special_requests' => $data['special_requests'] ?? null,
        ]);

        $this->sendPrivateTourConfirmation($inquiry);

        return $inquiry;
    }

    /**
     * Notify pending waitlist entries when capacity becomes available on a schedule.
     */
    public function notifyCapacityAvailable(TourSchedule $schedule): int
    {
        $availableSeats = $schedule->getAvailableSeats();
        if ($availableSeats <= 0 || ! $schedule->isAvailable()) {
            return 0;
        }

        $tour = $schedule->tour;
        $departureDate = optional($schedule->departure_date)->toDateString();

        // Find pending waitlist inquiries for this schedule or tour departure date
        $inquiries = TourInquiry::with('customer')
            ->where('tour_id', $schedule->tour_id)
            ->where(function ($q) use ($schedule) {
                $q->where('tour_schedule_id', $schedule->id)
                    ->orWhere(function ($sub) use ($schedule) {
                        $sub->whereNull('tour_schedule_id')
                            ->where('desired_date', $schedule->departure_date);
                    });
            })
            ->where('inquiry_type', TourInquiry::TYPE_SOLD_OUT_WAITLIST)
            ->where('status', TourInquiry::STATUS_PENDING)
            ->whereNull('notified_at')
            ->orderBy('id', 'asc')
            ->get();

        $notifiedCount = 0;
        foreach ($inquiries as $inquiry) {
            if ($inquiry->number_of_guests > $availableSeats) {
                continue;
            }

            $customer = $inquiry->customer ?? Customer::find($inquiry->customer_id);
            if (! $customer) {
                continue;
            }

            $tourTitle = $tour?->title ?? 'Tour';
            $message = "Great news! Seats have opened up for {$tourTitle} on {$departureDate}. Book now to secure your spot!";
            $content = [
                'sms' => 'Turiya Mobility: '.$message,
                'whatsapp' => "*Turiya Mobility Tour Seats Available*\n\n".$message,
                'email' => $message,
                'subject' => "Seats Available: {$tourTitle}",
            ];

            $channels = ['sms'];
            if (! empty($customer->email)) {
                $channels[] = 'email';
            }

            $this->notificationService->enqueue($customer, $channels, $content, [
                'dedup_key' => "tour:waitlist:capacity_alert:{$inquiry->id}:{$schedule->id}",
            ]);

            $inquiry->update(['notified_at' => now()]);
            $notifiedCount++;
        }

        return $notifiedCount;
    }

    private function sendWaitlistConfirmation(TourInquiry $inquiry): void
    {
        $customer = $inquiry->customer ?? Customer::find($inquiry->customer_id);
        if (! $customer) {
            return;
        }

        $tourTitle = $inquiry->tour?->title ?? 'Tour';
        $message = "You have joined the waitlist for {$tourTitle}. We'll notify you as soon as seats become available.";

        $this->notificationService->enqueue($customer, ['sms'], [
            'sms' => 'Turiya Mobility: '.$message,
            'whatsapp' => "*Turiya Mobility Waitlist*\n\n".$message,
            'email' => $message,
            'subject' => "Waitlist Confirmed: {$tourTitle}",
        ], [
            'dedup_key' => "tour:waitlist:joined:{$inquiry->id}",
        ]);
    }

    private function sendPrivateTourConfirmation(TourInquiry $inquiry): void
    {
        $customer = $inquiry->customer ?? Customer::find($inquiry->customer_id);
        if (! $customer) {
            return;
        }

        $tourTitle = $inquiry->tour?->title ?? 'Private Tour';
        $message = "We have received your private tour request for {$tourTitle}. Our operator will contact you shortly.";

        $this->notificationService->enqueue($customer, ['sms'], [
            'sms' => 'Turiya Mobility: '.$message,
            'whatsapp' => "*Turiya Mobility Private Tour*\n\n".$message,
            'email' => $message,
            'subject' => "Private Tour Request: {$tourTitle}",
        ], [
            'dedup_key' => "tour:private:request:{$inquiry->id}",
        ]);
    }
}
