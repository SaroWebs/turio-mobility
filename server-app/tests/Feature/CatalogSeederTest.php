<?php

use App\Models\Destination;
use App\Models\Place;
use App\Models\Tour;
use App\Models\TourItinerary;
use App\Models\TourSchedule;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\DestinationSeeder;
use Database\Seeders\ItinerarySeeder;
use Database\Seeders\NortheastCatalogSeeder;
use Database\Seeders\PlaceCategorySeeder;
use Database\Seeders\PlaceSeeder;
use Database\Seeders\TourSeeder;
use Illuminate\Support\Facades\Hash;

it('seeds the current schema with administrators and connected Northeast tours', function () {
    $this->seed(DatabaseSeeder::class);
    expect(User::count())->toBe(3)->and(Destination::count())->toBe(20)
        ->and(Place::count())->toBe(20)->and(Tour::count())->toBe(8)
        ->and(TourItinerary::count())->toBe(46)->and(TourSchedule::count())->toBe(24);
    foreach (User::all() as $user) {
        expect($user->hasRole('admin'))->toBeTrue()
            ->and($user->email_verified_at)->not->toBeNull()
            ->and(Hash::check(config('seeding.admin_password'), $user->password))->toBeTrue();
    }
    foreach (Destination::all() as $destination) {
        $place = Place::where('slug', $destination->slug)->firstOrFail();
        expect((float) $destination->latitude)->toBeBetween(23, 29)
            ->and((float) $destination->longitude)->toBeBetween(88, 95)
            ->and($destination->latitude)->toBe($place->latitude)
            ->and($destination->longitude)->toBe($place->longitude);
    }
    expect((float) Destination::where('slug', 'guwahati')->first()->latitude)->toBe(26.1445)
        ->and((float) Destination::where('slug', 'kaziranga-national-park')->first()->longitude)->toBe(93.416667);
    foreach (Tour::with(['itineraries.place', 'schedules'])->get() as $tour) {
        expect($tour->itineraries->pluck('day_number')->all())->toBe(range(1, $tour->duration_days))
            ->and((float) $tour->price_per_person)->toBeGreaterThan(0);
        foreach ($tour->itineraries as $stop) {
            expect($stop->place)->not->toBeNull();
        }
        foreach ($tour->schedules as $schedule) {
            expect($schedule->departure_at->isFuture())->toBeTrue()
                ->and($schedule->booked_seats)->toBe(0)
                ->and($schedule->reserved_seats)->toBe(0)
                ->and($schedule->getAvailableSeats())->toBe(12);
        }
    }
});

it('reruns catalog entry points without duplicates or resetting passwords and inventory', function () {
    $this->seed(NortheastCatalogSeeder::class);
    $admin = User::where('email', 'admin@skyslope.com')->firstOrFail();
    $admin->update(['password' => 'Changed-by-admin-123!']);
    $schedule = TourSchedule::firstOrFail();
    $schedule->update(['booked_seats' => 4, 'reserved_seats' => 2, 'status' => 'cancelled', 'price_override' => 20000]);
    foreach ([PlaceCategorySeeder::class, PlaceSeeder::class, DestinationSeeder::class, TourSeeder::class, ItinerarySeeder::class] as $seeder) {
        $this->seed($seeder);
    }
    expect(User::count())->toBe(3)->and(Destination::count())->toBe(20)
        ->and(Place::count())->toBe(20)->and(Tour::count())->toBe(8)
        ->and(TourItinerary::count())->toBe(46)->and(TourSchedule::count())->toBe(24)
        ->and(Hash::check('Changed-by-admin-123!', $admin->fresh()->password))->toBeTrue()
        ->and($schedule->fresh()->booked_seats)->toBe(4)
        ->and($schedule->fresh()->reserved_seats)->toBe(2)
        ->and($schedule->fresh()->status)->toBe('cancelled')
        ->and((float) $schedule->fresh()->price_override)->toBe(20000.0);
});
