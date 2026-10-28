<?php

use App\Models\Customer;
use App\Models\Place;
use App\Models\PlaceMedia;
use App\Models\Role;
use App\Models\Tour;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

it('keeps customer place photos private until an admin approves them', function () {
    Storage::fake('public');
    $place = Place::create(['name' => 'Lake View', 'slug' => 'lake-view', 'is_active' => true]);
    $customer = Customer::create(['name' => 'Photo Guest', 'phone' => '9000000077']);
    Sanctum::actingAs($customer);

    $response = $this->post('/api/customer-app/places/'.$place->id.'/media', [
        'image' => UploadedFile::fake()->image('lake.jpg', 1600, 900),
        'caption' => 'Sunset over the lake',
        'is_360' => true,
    ], ['Accept' => 'application/json']);

    $response->assertCreated()->assertJsonPath('data.approval_status', 'pending');
    $media = PlaceMedia::firstOrFail();
    expect($media->source)->toBe('customer')->and($media->type)->toBe('panorama');

    $this->getJson('/api/customer-app/public/destinations/'.$place->id)
        ->assertOk()
        ->assertJsonCount(0, 'data.media');

    $admin = User::create(['name' => 'Media Admin', 'email' => 'media-admin@example.com', 'password' => 'password']);
    $role = Role::create(['name' => 'admin', 'display_name' => 'Admin']);
    $admin->roles()->attach($role);
    $this->actingAs($admin)->patch('/admin/media/'.$media->id.'/approve')->assertRedirect();

    $this->getJson('/api/customer-app/public/destinations/'.$place->id)
        ->assertOk()
        ->assertJsonCount(1, 'data.media')
        ->assertJsonPath('data.media.0.type', 'panorama');
});

it('publishes admin place images and videos immediately', function () {
    Storage::fake('public');
    $place = Place::create(['name' => 'Fort', 'slug' => 'fort', 'is_active' => true]);
    $admin = User::create(['name' => 'Place Admin', 'email' => 'place-admin@example.com', 'password' => 'password']);
    $role = Role::create(['name' => 'admin', 'display_name' => 'Admin']);
    $admin->roles()->attach($role);

    $this->actingAs($admin)->post('/admin/places/'.$place->id.'/media', [
        'file' => UploadedFile::fake()->image('fort.jpg'),
        'type' => 'image',
        'caption' => 'Main gate',
    ])->assertRedirect();

    $this->assertDatabaseHas('place_media', [
        'place_id' => $place->id,
        'source' => 'admin',
        'approval_status' => 'approved',
    ]);
});

it('publishes admin panorama images as a distinct media type', function () {
    Storage::fake('public');
    $place = Place::create(['name' => 'Temple Courtyard', 'slug' => 'temple-courtyard', 'is_active' => true]);
    $admin = User::create(['name' => 'Panorama Admin', 'email' => 'panorama-admin@example.com', 'password' => 'password']);
    $role = Role::create(['name' => 'admin', 'display_name' => 'Admin']);
    $admin->roles()->attach($role);

    $this->actingAs($admin)->post('/admin/places/'.$place->id.'/media', [
        'file' => UploadedFile::fake()->image('view-360.jpg', 1600, 800),
        'type' => 'panorama',
        'caption' => 'Temple courtyard 360 view',
    ])->assertRedirect();

    $this->assertDatabaseHas('place_media', [
        'place_id' => $place->id,
        'type' => 'panorama',
        'approval_status' => 'approved',
    ]);
});

it('returns related tours on a public destination detail', function () {
    $place = Place::create([
        'name' => 'Lake View',
        'slug' => 'lake-view',
        'is_active' => true,
    ]);
    $tour = Tour::create([
        'title' => 'Lake View Adventure',
        'slug' => 'lake-view-adventure',
        'price_per_person' => 1500,
        'child_price' => 750,
        'available_from' => now(),
        'available_to' => now()->addMonth(),
        'is_active' => true,
    ]);

    $this->getJson('/api/customer-app/public/destinations/'.$place->id)
        ->assertOk()
        ->assertJsonPath('data.active_tours.0.id', $tour->id)
        ->assertJsonPath('data.active_tours.0.title', 'Lake View Adventure');
});
