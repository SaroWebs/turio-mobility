<?php

use App\Models\Driver;
use App\Models\Guide;
use App\Models\Tour;
use App\Models\TourDriverAssignment;
use App\Models\TourGuideAssignment;
use App\Models\TourSchedule;

it('migrates guide profiles into drivers and preserves legacy guide records', function () {
    $guide = Guide::create([
        'name' => 'Legacy Guide',
        'email' => 'legacy-guide@example.com',
        'phone' => '9700000001',
        'password' => 'secret',
        'bio' => 'Knows every fort story.',
        'languages' => ['English', 'Hindi'],
        'specializations' => ['History', 'Architecture'],
        'experience_years' => 8,
        'certification_number' => 'GUIDE-CERT-1',
        'certification_expiry' => now()->addYear()->toDateString(),
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
        'approved_at' => now(),
        'approved_by' => 1,
        'rating' => 4.8,
        'total_tours' => 37,
    ]);

    $tour = Tour::create([
        'title' => 'Migration Tour',
        'slug' => 'migration-tour',
        'duration_days' => 1,
        'duration_nights' => 0,
        'price_per_person' => 1000,
        'child_price' => 500,
        'available_from' => now(),
        'available_to' => now()->addMonth(),
        'is_active' => true,
    ]);

    $schedule = TourSchedule::create([
        'tour_id' => $tour->id,
        'departure_date' => now()->addWeek()->toDateString(),
        'return_date' => now()->addWeek()->toDateString(),
        'total_seats' => 10,
        'booked_seats' => 0,
        'reserved_seats' => 0,
        'status' => 'open',
    ]);

    $guideAssignment = TourGuideAssignment::create([
        'tour_schedule_id' => $schedule->id,
        'guide_id' => $guide->id,
        'role' => 'lead',
        'status' => 'accepted',
        'fee' => 1500,
        'notes' => 'Legacy assignment notes.',
    ]);

    $this->artisan('guides:migrate-to-drivers --sync-assignments')
        ->assertExitCode(0);

    $driver = Driver::where('phone', $guide->phone)->firstOrFail();

    expect($driver->name)->toBe($guide->name)
        ->and($driver->email)->toBe($guide->email)
        ->and($driver->can_tour_lead)->toBeTrue()
        ->and($driver->can_tour_transport)->toBeTrue()
        ->and($driver->languages)->toBe(['English', 'Hindi'])
        ->and($driver->expertise_tags)->toBe(['History', 'Architecture'])
        ->and($driver->certification_notes)->toContain("legacy guide #{$guide->id}")
        ->and($driver->certification_notes)->toContain('GUIDE-CERT-1');

    $this->assertDatabaseHas('guides', ['id' => $guide->id, 'phone' => $guide->phone]);
    $this->assertDatabaseHas('tour_driver_assignments', [
        'tour_schedule_id' => $schedule->id,
        'driver_id' => $driver->id,
        'role' => 'lead',
        'status' => 'accepted',
    ]);

    $driverAssignment = TourDriverAssignment::where('tour_schedule_id', $schedule->id)
        ->where('driver_id', $driver->id)
        ->firstOrFail();

    expect($driverAssignment->notes)->toContain("legacy guide assignment #{$guideAssignment->id}");
});

it('keeps dry run guide migration changes rolled back', function () {
    $guide = Guide::create([
        'name' => 'Dry Run Guide',
        'phone' => '9700000002',
        'languages' => ['English'],
        'specializations' => ['Nature'],
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
    ]);

    $this->artisan('guides:migrate-to-drivers --dry-run')
        ->assertExitCode(0);

    $this->assertDatabaseMissing('drivers', ['phone' => $guide->phone]);
    $this->assertDatabaseHas('guides', ['id' => $guide->id]);
});

it('merges guide profile fields into an existing driver by phone', function () {
    $driver = Driver::create([
        'name' => 'Existing Driver',
        'phone' => '9700000003',
        'email' => 'existing-driver@example.com',
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
        'languages' => ['English'],
        'expertise_tags' => ['Local'],
        'certification_notes' => 'Existing notes.',
    ]);

    $guide = Guide::create([
        'name' => 'Existing Guide',
        'phone' => $driver->phone,
        'email' => 'existing-guide@example.com',
        'bio' => 'Adds tour expertise.',
        'languages' => ['French'],
        'specializations' => ['History'],
        'experience_years' => 4,
        'status' => 'active',
        'is_active' => true,
        'is_approved' => true,
    ]);

    $this->artisan('guides:migrate-to-drivers')
        ->assertExitCode(0);

    $driver->refresh();

    expect(Driver::where('phone', $guide->phone)->count())->toBe(1)
        ->and($driver->name)->toBe('Existing Driver')
        ->and($driver->email)->toBe('existing-driver@example.com')
        ->and($driver->can_tour_lead)->toBeTrue()
        ->and($driver->can_tour_transport)->toBeTrue()
        ->and($driver->languages)->toBe(['English', 'French'])
        ->and($driver->expertise_tags)->toBe(['Local', 'History'])
        ->and($driver->certification_notes)->toContain('Existing notes.')
        ->and($driver->certification_notes)->toContain("legacy guide #{$guide->id}");
});
