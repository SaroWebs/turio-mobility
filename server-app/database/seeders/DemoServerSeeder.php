<?php

namespace Database\Seeders;

use App\Models\CarCategory;
use App\Models\CarRental;
use App\Models\CarRentalReview;
use App\Models\Customer;
use App\Models\Driver;
use App\Models\Place;
use App\Models\PlaceCategory;
use App\Models\PlaceReview;
use App\Models\RideBooking;
use App\Models\RideBookingReview;
use App\Models\Tour;
use App\Models\TourBooking;
use App\Models\TourBookingReview;
use App\Models\TourCategory;
use App\Models\TourDriverAssignment;
use App\Models\TourItinerary;
use App\Models\TourSchedule;
use App\Models\Vehicle;
use App\Models\Wallet;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class DemoServerSeeder extends Seeder
{
    public function run(): void
    {
        $customers = $this->seedCustomers();
        $carCategories = $this->seedCarCategories();
        $drivers = $this->seedDrivers();
        $vehicles = $this->seedVehicles($drivers, $carCategories);
        $places = $this->seedPlaces($customers);
        [$tours, $schedules] = $this->seedTours($places);

        $this->seedWallets($customers, $drivers);
        $this->seedAssignments($schedules, $drivers, $vehicles);
        $this->seedBookings($customers, $drivers, $vehicles, $carCategories, $tours, $schedules);

        $this->command?->info('Demo server data seeded.');
    }

    private function seedCustomers(): array
    {
        $rows = [
            [
                'phone' => '9001000001',
                'name' => 'Asha Mehta',
                'email' => 'asha.demo@example.com',
                'gender' => 'female',
                'emergency_contact_name' => 'Rohan Mehta',
                'emergency_contact_phone' => '9001000091',
            ],
            [
                'phone' => '9001000002',
                'name' => 'Vikram Rao',
                'email' => 'vikram.demo@example.com',
                'gender' => 'male',
                'emergency_contact_name' => 'Neha Rao',
                'emergency_contact_phone' => '9001000092',
            ],
            [
                'phone' => '9001000003',
                'name' => 'Naina Kapoor',
                'email' => 'naina.demo@example.com',
                'gender' => 'female',
                'emergency_contact_name' => 'Arjun Kapoor',
                'emergency_contact_phone' => '9001000093',
            ],
        ];

        return collect($rows)
            ->mapWithKeys(fn (array $row) => [
                $row['phone'] => Customer::updateOrCreate(
                    ['phone' => $row['phone']],
                    array_merge($row, [
                        'password' => Hash::make('password'),
                        'is_active' => true,
                        'phone_verified_at' => now(),
                    ])
                ),
            ])
            ->all();
    }

    private function seedCarCategories(): array
    {
        $rows = [
            [
                'name' => 'Demo Sedan',
                'vehicle_type' => 'sedan',
                'seats' => 4,
                'base_fare' => 70,
                'price_per_km' => 18,
                'price_per_minute' => 2.5,
                'min_fare' => 160,
                'base_price_per_day' => 2400,
                'extra_km_charge' => 16,
                'features' => ['AC', 'Luggage space', 'Phone charger'],
            ],
            [
                'name' => 'Demo SUV',
                'vehicle_type' => 'suv',
                'seats' => 6,
                'base_fare' => 110,
                'price_per_km' => 26,
                'price_per_minute' => 3.5,
                'min_fare' => 260,
                'base_price_per_day' => 4200,
                'extra_km_charge' => 24,
                'features' => ['AC', 'Captain seats', 'Hill luggage space'],
            ],
        ];

        return collect($rows)
            ->mapWithKeys(fn (array $row) => [
                $row['vehicle_type'] => CarCategory::updateOrCreate(
                    ['slug' => Str::slug($row['name'])],
                    array_merge($row, [
                        'slug' => Str::slug($row['name']),
                        'has_ac' => true,
                        'has_driver' => true,
                        'fuel_type' => 'petrol',
                        'is_active' => true,
                    ])
                ),
            ])
            ->all();
    }

    private function seedDrivers(): array
    {
        $rows = [
            [
                'phone' => '8001000001',
                'name' => 'Ravi Sharma',
                'email' => 'ravi.driver@example.com',
                'vehicle_type' => 'sedan',
                'rating' => 4.82,
                'can_short_ride' => true,
                'can_long_ride' => true,
                'can_tour_lead' => true,
                'can_tour_transport' => true,
                'can_rental_delivery' => true,
                'languages' => ['English', 'Hindi'],
                'expertise_tags' => ['City history', 'Family tours'],
            ],
            [
                'phone' => '8001000002',
                'name' => 'Imran Qureshi',
                'email' => 'imran.driver@example.com',
                'vehicle_type' => 'suv',
                'rating' => 4.74,
                'can_short_ride' => true,
                'can_long_ride' => true,
                'can_tour_lead' => false,
                'can_tour_transport' => true,
                'can_rental_delivery' => true,
                'languages' => ['English', 'Hindi', 'Urdu'],
                'expertise_tags' => ['Mountain routes', 'Long rides'],
            ],
            [
                'phone' => '8001000003',
                'name' => 'Meera Joshi',
                'email' => 'meera.driver@example.com',
                'vehicle_type' => 'sedan',
                'rating' => 4.91,
                'can_short_ride' => true,
                'can_long_ride' => false,
                'can_tour_lead' => true,
                'can_tour_transport' => true,
                'can_rental_delivery' => false,
                'languages' => ['English', 'Hindi', 'Marathi'],
                'expertise_tags' => ['Food walks', 'Heritage'],
            ],
        ];

        return collect($rows)
            ->mapWithKeys(fn (array $row) => [
                $row['phone'] => Driver::updateOrCreate(
                    ['phone' => $row['phone']],
                    array_merge($row, [
                        'password' => Hash::make('password'),
                        'status' => 'active',
                        'is_active' => true,
                        'is_approved' => true,
                        'approved_at' => now()->subMonths(2),
                        'phone_verified_at' => now()->subMonths(2),
                        'certification_notes' => 'Demo verified partner profile.',
                    ])
                ),
            ])
            ->all();
    }

    private function seedVehicles(array $drivers, array $categories): array
    {
        $rows = [
            '8001000001' => ['category' => 'sedan', 'registration_number' => 'RJ14DE1001', 'make' => 'Maruti', 'model' => 'Ciaz', 'year' => 2022, 'color' => 'White', 'seats' => 4],
            '8001000002' => ['category' => 'suv', 'registration_number' => 'RJ14DE1002', 'make' => 'Toyota', 'model' => 'Innova Crysta', 'year' => 2021, 'color' => 'Silver', 'seats' => 6],
            '8001000003' => ['category' => 'sedan', 'registration_number' => 'RJ14DE1003', 'make' => 'Honda', 'model' => 'City', 'year' => 2023, 'color' => 'Blue', 'seats' => 4],
        ];

        return collect($rows)
            ->mapWithKeys(function (array $row, string $driverPhone) use ($drivers, $categories) {
                $driver = $drivers[$driverPhone];
                $category = $categories[$row['category']];
                unset($row['category']);

                return [
                    $driverPhone => Vehicle::updateOrCreate(
                        ['registration_number' => $row['registration_number']],
                        array_merge($row, [
                            'car_category_id' => $category->id,
                            'driver_id' => $driver->id,
                            'fuel_type' => 'petrol',
                            'is_ac' => true,
                            'is_active' => true,
                            'condition' => 'excellent',
                            'insurance_expiry' => now()->addYear()->toDateString(),
                            'permit_expiry' => now()->addYear()->toDateString(),
                            'fitness_expiry' => now()->addYear()->toDateString(),
                            'pollution_expiry' => now()->addMonths(8)->toDateString(),
                            'odometer_km' => 24000,
                        ])
                    ),
                ];
            })
            ->all();
    }

    private function seedPlaces(array $customers): array
    {
        $category = PlaceCategory::firstOrCreate(
            ['slug' => 'heritage-demo'],
            ['name' => 'Heritage Demo', 'description' => 'Featured demo heritage places', 'is_active' => true]
        );

        $rows = [
            [
                'slug' => 'amber-fort-demo',
                'name' => 'Amber Fort',
                'city' => 'Jaipur',
                'state' => 'Rajasthan',
                'latitude' => 26.9855,
                'longitude' => 75.8513,
                'google_place_id' => 'demo-google-amber-fort',
                'google_rating' => 4.7,
                'google_review_count' => 45612,
                'tags' => ['fort', 'heritage', 'sunset'],
            ],
            [
                'slug' => 'nahargarh-fort-demo',
                'name' => 'Nahargarh Fort',
                'city' => 'Jaipur',
                'state' => 'Rajasthan',
                'latitude' => 26.9373,
                'longitude' => 75.8155,
                'google_place_id' => 'demo-google-nahargarh-fort',
                'google_rating' => 4.6,
                'google_review_count' => 28420,
                'tags' => ['viewpoint', 'heritage', 'city lights'],
            ],
            [
                'slug' => 'city-palace-demo',
                'name' => 'City Palace',
                'city' => 'Jaipur',
                'state' => 'Rajasthan',
                'latitude' => 26.9258,
                'longitude' => 75.8237,
                'google_place_id' => 'demo-google-city-palace',
                'google_rating' => 4.5,
                'google_review_count' => 33990,
                'tags' => ['palace', 'museum', 'architecture'],
            ],
        ];

        $places = collect($rows)
            ->mapWithKeys(function (array $row) use ($category) {
                $place = Place::updateOrCreate(
                    ['slug' => $row['slug']],
                    array_merge($row, [
                        'place_category_id' => $category->id,
                        'description' => "Demo profile for {$row['name']} with cached Google summary.",
                        'short_description' => "Popular {$row['city']} stop for curated tours.",
                        'location' => "{$row['city']}, {$row['state']}",
                        'country' => 'India',
                        'rating' => 4.6,
                        'review_count' => 2,
                        'google_reviews' => [
                            ['author_name' => 'Google Local Guide', 'rating' => 5, 'text' => 'Beautifully maintained and easy to explore.'],
                            ['author_name' => 'Weekend Traveller', 'rating' => 4, 'text' => 'Great stop with helpful guides nearby.'],
                        ],
                        'google_photos' => [
                            ['photo_reference' => "demo-photo-{$row['slug']}-1", 'width' => 1200, 'height' => 800],
                            ['photo_reference' => "demo-photo-{$row['slug']}-2", 'width' => 1200, 'height' => 800],
                        ],
                        'google_synced_at' => now()->subDays(3),
                        'is_active' => true,
                        'is_featured' => true,
                    ])
                );

                return [$row['slug'] => $place];
            })
            ->all();

        $reviewTexts = [
            'The pickup advice and local context made this much easier to enjoy.',
            'Clean stop, good photo points, and worth pairing with a guided route.',
        ];

        foreach ($places as $place) {
            foreach (array_values($customers) as $index => $customer) {
                PlaceReview::updateOrCreate(
                    ['place_id' => $place->id, 'customer_id' => $customer->id],
                    ['rating' => 5 - ($index % 2), 'review' => $reviewTexts[$index % count($reviewTexts)]]
                );
            }

            $place->update([
                'rating' => round((float) $place->reviews()->avg('rating'), 2),
                'review_count' => $place->reviews()->count(),
            ]);
        }

        return $places;
    }

    private function seedTours(array $places): array
    {
        $category = TourCategory::firstOrCreate(
            ['slug' => 'heritage-circuit-demo'],
            ['name' => 'Heritage Circuit Demo', 'is_active' => true]
        );

        $tour = Tour::updateOrCreate(
            ['slug' => 'jaipur-heritage-weekend-demo'],
            [
                'tour_category_id' => $category->id,
                'title' => 'Jaipur Heritage Weekend',
                'description' => 'A compact demo itinerary covering forts, palaces, markets, and sunset viewpoints.',
                'short_description' => 'Two-day heritage route through Jaipur highlights.',
                'highlights' => ['Amber Fort', 'City Palace', 'Nahargarh sunset'],
                'inclusions' => ['Driver partner', 'Tour lead', 'Bottled water'],
                'exclusions' => ['Meals', 'Entry tickets'],
                'duration_days' => 2,
                'duration_nights' => 1,
                'min_group_size' => 2,
                'max_group_size' => 8,
                'price_per_person' => 4800,
                'child_price' => 2600,
                'start_location' => 'Jaipur Airport',
                'end_location' => 'Jaipur Railway Station',
                'region' => 'Rajasthan',
                'difficulty' => 'easy',
                'available_from' => now()->toDateString(),
                'available_to' => now()->addMonths(6)->toDateString(),
                'is_active' => true,
                'is_featured' => true,
            ]
        );

        TourItinerary::updateOrCreate(
            ['tour_id' => $tour->id, 'day_number' => 1],
            [
                'title' => 'Forts and Old City',
                'description' => 'Amber Fort, City Palace, and evening bazaar walk.',
                'activities' => ['Fort visit', 'Museum stop', 'Market walk'],
                'meals_included' => ['breakfast'],
                'distance_km' => 38,
            ]
        );

        TourItinerary::updateOrCreate(
            ['tour_id' => $tour->id, 'day_number' => 2],
            [
                'title' => 'Viewpoints and Departure',
                'description' => 'Nahargarh viewpoint and relaxed transfer back into the city.',
                'activities' => ['Viewpoint', 'Photo stop', 'Departure transfer'],
                'meals_included' => ['breakfast'],
                'distance_km' => 26,
            ]
        );

        $scheduleOne = TourSchedule::updateOrCreate(
            ['tour_id' => $tour->id, 'departure_date' => now()->addDays(14)->toDateString()],
            [
                'return_date' => now()->addDays(15)->toDateString(),
                'departure_time' => '08:30',
                'departure_point' => 'Jaipur Airport arrivals',
                'total_seats' => 12,
                'booked_seats' => 2,
                'reserved_seats' => 1,
                'status' => 'open',
            ]
        );

        $scheduleTwo = TourSchedule::updateOrCreate(
            ['tour_id' => $tour->id, 'departure_date' => now()->addDays(28)->toDateString()],
            [
                'return_date' => now()->addDays(29)->toDateString(),
                'departure_time' => '08:30',
                'departure_point' => 'MI Road pickup hub',
                'total_seats' => 10,
                'booked_seats' => 0,
                'reserved_seats' => 0,
                'status' => 'open',
            ]
        );

        return [[$tour->slug => $tour], [$scheduleOne->departure_date->toDateString() => $scheduleOne, $scheduleTwo->departure_date->toDateString() => $scheduleTwo]];
    }

    private function seedWallets(array $customers, array $drivers): void
    {
        foreach (array_merge(array_values($customers), array_values($drivers)) as $owner) {
            Wallet::updateOrCreate(
                ['owner_type' => $owner::class, 'owner_id' => $owner->id],
                ['balance' => $owner instanceof Customer ? 10000 : 2500, 'currency' => 'INR', 'is_active' => true]
            );
        }
    }

    private function seedAssignments(array $schedules, array $drivers, array $vehicles): void
    {
        $schedule = reset($schedules);
        $driver = $drivers['8001000001'];
        $vehicle = $vehicles['8001000001'];

        TourDriverAssignment::updateOrCreate(
            ['tour_schedule_id' => $schedule->id, 'driver_id' => $driver->id],
            [
                'vehicle_id' => $vehicle->id,
                'role' => 'lead',
                'status' => 'accepted',
                'fee' => 2400,
                'notes' => 'Demo tour lead assignment.',
            ]
        );

        TourDriverAssignment::updateOrCreate(
            ['tour_schedule_id' => $schedule->id, 'driver_id' => $drivers['8001000002']->id],
            [
                'vehicle_id' => $vehicles['8001000002']->id,
                'role' => 'transport',
                'status' => 'assigned',
                'fee' => 2200,
                'notes' => 'Demo transport assignment.',
            ]
        );
    }

    private function seedBookings(array $customers, array $drivers, array $vehicles, array $categories, array $tours, array $schedules): void
    {
        $customer = $customers['9001000001'];
        $driver = $drivers['8001000001'];
        $vehicle = $vehicles['8001000001'];
        $sedan = $categories['sedan'];
        $tour = reset($tours);
        $schedule = reset($schedules);

        $ride = RideBooking::updateOrCreate(
            ['booking_number' => 'RIDE-DEMO-0001'],
            [
                'customer_id' => $customer->id,
                'driver_id' => $driver->id,
                'car_category_id' => $sedan->id,
                'vehicle_id' => $vehicle->id,
                'service_type' => 'point_to_point',
                'customer_name' => $customer->name,
                'customer_email' => $customer->email,
                'customer_phone' => $customer->phone,
                'pickup_location' => 'Jaipur Airport',
                'pickup_lat' => 26.8242,
                'pickup_lng' => 75.8122,
                'dropoff_location' => 'City Palace',
                'dropoff_lat' => 26.9258,
                'dropoff_lng' => 75.8237,
                'scheduled_at' => now()->subDays(3),
                'driver_assigned_at' => now()->subDays(3)->addMinutes(5),
                'started_at' => now()->subDays(3)->addMinutes(25),
                'completed_at' => now()->subDays(3)->addMinutes(70),
                'estimated_duration' => 45,
                'actual_duration' => 45,
                'estimated_distance_km' => 13.2,
                'actual_distance_km' => 13.7,
                'base_fare' => 70,
                'distance_fare' => 246.6,
                'time_fare' => 112.5,
                'total_fare' => 429.1,
                'commission_amount' => 64.37,
                'driver_share' => 364.73,
                'status' => 'completed',
                'payment_status' => 'paid',
                'payment_method' => 'wallet',
            ]
        );

        RideBookingReview::updateOrCreate(
            ['ride_booking_id' => $ride->id, 'customer_id' => $customer->id],
            ['driver_id' => $driver->id, 'driver_rating' => 5, 'customer_rating' => 5, 'review' => 'Smooth pickup, clean car, and careful driving.']
        );

        $tourBooking = TourBooking::updateOrCreate(
            ['booking_number' => 'TOUR-DEMO-0001'],
            [
                'customer_id' => $customer->id,
                'tour_id' => $tour->id,
                'tour_schedule_id' => $schedule->id,
                'number_of_adults' => 2,
                'number_of_children' => 0,
                'travel_date' => $schedule->departure_date->toDateString(),
                'customer_name' => $customer->name,
                'customer_email' => $customer->email,
                'customer_phone' => $customer->phone,
                'price_per_adult' => $tour->price_per_person,
                'price_per_child' => $tour->child_price,
                'subtotal' => 9600,
                'total_price' => 9600,
                'status' => 'completed',
                'payment_status' => 'paid',
                'payment_method' => 'card',
                'assigned_driver_id' => $driver->id,
                'assigned_vehicle_id' => $vehicle->id,
            ]
        );

        TourBookingReview::updateOrCreate(
            ['tour_booking_id' => $tourBooking->id, 'customer_id' => $customer->id],
            ['driver_id' => $driver->id, 'tour_rating' => 5, 'driver_rating' => 5, 'review' => 'The heritage route felt polished and well paced.']
        );

        $rental = CarRental::updateOrCreate(
            ['booking_number' => 'CAR-DEMO-0001'],
            [
                'customer_id' => $customers['9001000002']->id,
                'driver_id' => $drivers['8001000002']->id,
                'vehicle_id' => $vehicles['8001000002']->id,
                'car_category_id' => $categories['suv']->id,
                'customer_name' => $customers['9001000002']->name,
                'customer_email' => $customers['9001000002']->email,
                'customer_phone' => $customers['9001000002']->phone,
                'start_date' => now()->subDays(7)->toDateString(),
                'end_date' => now()->subDays(5)->toDateString(),
                'number_of_days' => 3,
                'pickup_location' => 'MI Road pickup hub',
                'pickup_lat' => 26.9155,
                'pickup_lng' => 75.8072,
                'dropoff_location' => 'Jaipur Airport',
                'dropoff_lat' => 26.8242,
                'dropoff_lng' => 75.8122,
                'destination_details' => 'Jaipur - Pushkar - Jaipur',
                'base_price' => 12600,
                'distance_km' => 80,
                'distance_price' => 1920,
                'total_price' => 14520,
                'commission_amount' => 2178,
                'driver_share' => 12342,
                'status' => 'completed',
                'payment_status' => 'paid',
                'payment_method' => 'upi',
            ]
        );

        CarRentalReview::updateOrCreate(
            ['car_rental_id' => $rental->id, 'customer_id' => $rental->customer_id],
            ['driver_id' => $rental->driver_id, 'rental_rating' => 5, 'driver_rating' => 5, 'review' => 'Vehicle was comfortable for the whole outstation route.']
        );
    }
}
