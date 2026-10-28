<?php

use App\Models\CarCategory;

it('charges only kilometres exceeding the daily allowance', function (float $distance, float $expected) {
    $category = new CarCategory(['base_price_per_day' => 1000, 'included_km_per_day' => 100, 'extra_km_charge' => 10]);
    expect($category->calculatePrice(2, $distance)['subtotal'])->toBe($expected);
})->with([[100.0, 2000.0], [200.0, 2000.0], [250.0, 2500.0]]);

it('does not infer an allowance for legacy categories', function () {
    $category = new CarCategory(['base_price_per_day' => 1000, 'extra_km_charge' => 10]);
    expect($category->calculatePrice(1, 200)['subtotal'])->toBe(1000.0);
});
