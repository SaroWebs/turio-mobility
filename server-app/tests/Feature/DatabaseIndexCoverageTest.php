<?php

use Illuminate\Support\Facades\DB;

it('keeps indexes for common tracking and dispatch queries', function () {
    if (DB::connection()->getDriverName() !== 'sqlite') {
        $this->markTestSkipped('SQLite PRAGMA index inspection is used for this schema coverage test.');
    }

    $expectedIndexes = [
        'driver_availabilities' => [
            'idx_da_available_status_updated',
            'idx_da_available_status_location',
        ],
        'driver_locations' => [
            'idx_dl_context_created',
            'idx_dl_driver_context_created',
        ],
        'ride_dispatch_attempts' => [
            'idx_rda_status_expires',
            'idx_rda_driver_status_created',
        ],
        'ride_bookings' => [
            'idx_rb_dispatch_queue',
            'idx_rb_driver_status_sched',
        ],
        'car_rentals' => [
            'idx_cr_driver_status_start',
        ],
        'tour_bookings' => [
            'idx_tb_driver_status_travel',
        ],
        'tour_driver_assignments' => [
            'idx_tda_driver_status_created',
        ],
    ];

    foreach ($expectedIndexes as $table => $indexNames) {
        $actualIndexes = collect(DB::select("PRAGMA index_list('{$table}')"))
            ->pluck('name')
            ->all();

        foreach ($indexNames as $indexName) {
            expect($actualIndexes)->toContain($indexName);
        }
    }
});
