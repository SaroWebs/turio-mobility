<?php

use Illuminate\Http\Request;
use Illuminate\Routing\Route;

function assertMobileRouteExists(string $method, string $uri): void
{
    $route = app('router')->getRoutes()->match(Request::create($uri, $method));

    expect($route)->toBeInstanceOf(Route::class);
}

it('registers every API route called by the customer mobile app', function () {
    $routes = [
        ['GET', '/api/customer-app/me'],
        ['POST', '/api/customer-app/otp/send'],
        ['POST', '/api/customer-app/otp/verify'],
        ['POST', '/api/customer-app/otp/register-complete'],
        ['POST', '/api/customer-app/logout'],
        ['GET', '/api/customer-app/wallet'],
        ['GET', '/api/customer-app/wallet/transactions'],
        ['POST', '/api/customer-app/wallet/topup/order'],
        ['POST', '/api/customer-app/wallet/topup/verify'],
        ['GET', '/api/customer-app/public/tours'],
        ['GET', '/api/customer-app/public/cms/customer-mobile'],
        ['GET', '/api/customer-app/public/car-categories'],
        ['GET', '/api/customer-app/public/locations/search'],
        ['GET', '/api/customer-app/public/locations/place-details'],
        ['POST', '/api/customer-app/public/directions'],
        ['POST', '/api/customer-app/public/rides/estimate'],
        ['GET', '/api/customer-app/rides'],
        ['POST', '/api/customer-app/rides'],
        ['GET', '/api/customer-app/rides/1'],
        ['GET', '/api/customer-app/car-rentals'],
        ['POST', '/api/customer-app/car-rentals'],
        ['GET', '/api/customer-app/tour-bookings'],
        ['GET', '/api/customer-app/tour-schedules/1'],
        ['POST', '/api/customer-app/tours/book'],
    ];

    foreach ($routes as [$method, $uri]) {
        assertMobileRouteExists($method, $uri);
    }
});

it('registers every API route called by the driver app', function () {
    $routes = [
        ['GET', '/api/driver-app/me'],
        ['POST', '/api/driver-app/otp/send'],
        ['POST', '/api/driver-app/otp/verify'],
        ['POST', '/api/driver-app/otp/register-complete'],
        ['POST', '/api/driver-app/logout'],
        ['GET', '/api/driver-app/dashboard'],
        ['GET', '/api/driver-app/public/cms/driver-app'],
        ['GET', '/api/driver-app/pending-rides'],
        ['GET', '/api/driver-app/history'],
        ['GET', '/api/driver-app/vehicle'],
        ['PUT', '/api/driver-app/vehicle'],
        ['PUT', '/api/driver-app/availability'],
        ['GET', '/api/driver-app/active-ride'],
        ['POST', '/api/driver-app/directions'],
        ['POST', '/api/driver-app/rides/1/accept'],
        ['POST', '/api/driver-app/rides/1/decline'],
        ['GET', '/api/driver-app/tour-assignments'],
        ['POST', '/api/driver-app/tour-assignments/1/accept'],
        ['POST', '/api/driver-app/tour-assignments/1/decline'],
        ['POST', '/api/driver-app/tour-assignments/1/complete'],
        ['GET', '/api/driver-app/rental-assignments'],
        ['POST', '/api/driver-app/rentals/1/accept'],
        ['POST', '/api/driver-app/rentals/1/decline'],
        ['POST', '/api/driver-app/tracking/location'],
        ['POST', '/api/driver-app/tracking/ride/1/status'],
        ['POST', '/api/driver-app/tracking/tour/1/location'],
        ['POST', '/api/driver-app/tracking/tour/1/status'],
        ['POST', '/api/driver-app/tracking/rental/1/location'],
        ['POST', '/api/driver-app/tracking/rental/1/status'],
        ['GET', '/api/driver-app/wallet'],
        ['GET', '/api/driver-app/wallet/transactions'],
    ];

    foreach ($routes as [$method, $uri]) {
        assertMobileRouteExists($method, $uri);
    }
});

it('authenticates private broadcast channels with sanctum tokens', function () {
    $route = app('router')->getRoutes()->match(Request::create('/broadcasting/auth', 'POST'));

    expect($route->gatherMiddleware())->toContain('auth:sanctum');
});
