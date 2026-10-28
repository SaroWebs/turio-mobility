<?php

use App\Jobs\SendBookingLifecycleNotification;
use App\Models\Customer;
use App\Models\OutboxMessage;
use App\Models\RideBooking;
use App\Services\NotificationService;

it('enqueues booking lifecycle notifications to the outbox for enabled channels', function () {
    $customer = Customer::create([
        'name' => 'Lifecycle Customer',
        'phone' => '9400000001',
        'email' => 'lifecycle@example.com',
    ]);

    $ride = RideBooking::create([
        'customer_id' => $customer->id,
        'service_type' => 'point_to_point',
        'customer_name' => $customer->name,
        'customer_email' => $customer->email,
        'customer_phone' => $customer->phone,
        'pickup_location' => 'Gate',
        'scheduled_at' => now()->addDay(),
        'estimated_distance_km' => 7,
        'total_fare' => 280,
        'status' => 'confirmed',
        'payment_status' => 'paid',
        'payment_method' => 'cash',
        'sms_notification' => true,
        'whatsapp_notification' => true,
        'email_notification' => true,
    ]);

    (new SendBookingLifecycleNotification('ride', $ride->id, 'payment.paid'))
        ->handle(app(NotificationService::class));

    // One durable row per enabled channel, all pending (nothing delivered inline
    // under the sync queue), carrying the right recipients and content.
    $messages = OutboxMessage::orderBy('id')->get();

    expect($messages->pluck('channel')->all())->toBe(['sms', 'whatsapp', 'email'])
        ->and($messages->pluck('status')->unique()->values()->all())->toBe([OutboxMessage::STATUS_PENDING])
        ->and($messages->firstWhere('channel', 'sms')->body)->toContain('Payment received')
        ->and($messages->firstWhere('channel', 'sms')->recipient)->toBe('9400000001')
        ->and($messages->firstWhere('channel', 'email')->recipient)->toBe('lifecycle@example.com');
});

it('does not double-enqueue the same booking lifecycle event on redelivery', function () {
    $customer = Customer::create([
        'name' => 'Dedup Customer',
        'phone' => '9400000002',
    ]);

    $ride = RideBooking::create([
        'customer_id' => $customer->id,
        'service_type' => 'point_to_point',
        'customer_name' => $customer->name,
        'customer_phone' => $customer->phone,
        'pickup_location' => 'Gate',
        'scheduled_at' => now()->addDay(),
        'estimated_distance_km' => 7,
        'total_fare' => 280,
        'status' => 'confirmed',
        'payment_status' => 'pending',
        'payment_method' => 'cash',
        'sms_notification' => true,
        'whatsapp_notification' => false,
        'email_notification' => false,
    ]);

    $job = new SendBookingLifecycleNotification('ride', $ride->id, 'booking.created');
    $service = app(NotificationService::class);

    $job->handle($service);
    $job->handle($service); // a redelivered job must not enqueue a second time

    expect(OutboxMessage::where('channel', 'sms')->count())->toBe(1)
        ->and($job->tries)->toBe(3)
        ->and($job->backoff)->toBe([60, 300, 900]);
});

it('renders lifecycle email content without colliding with the mail message variable', function () {
    $sent = app(NotificationService::class)->sendEmail(
        'lifecycle@example.com',
        'Ride update',
        'emails.notification',
        ['notificationMessage' => 'Your ride has been completed.'],
    );

    expect($sent)->toBeTrue();
});

it('treats copied example provider credentials as unconfigured', function () {
    config([
        'services.whatsapp.api_url' => 'https://graph.facebook.com/v17.0',
        'services.whatsapp.api_key' => 'your_whatsapp_api_key',
        'services.whatsapp.from' => '1234567890',
    ]);

    expect(app(NotificationService::class)->isChannelConfigured('whatsapp'))->toBeFalse();
});
