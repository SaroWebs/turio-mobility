<?php

use App\Models\Customer;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

it('allows customer to update profile details', function () {
    $customer = Customer::create([
        'name' => 'Initial Name',
        'phone' => '9988776655',
        'email' => 'initial@example.com',
        'password' => bcrypt('password'),
        'phone_verified_at' => now(),
        'is_active' => true,
    ]);

    Sanctum::actingAs($customer, ['*']);

    $response = $this->putJson('/api/customer-app/profile', [
        'name' => 'Updated Name',
        'email' => 'updated@example.com',
        'gender' => 'female',
        'date_of_birth' => '1995-06-15',
        'emergency_contact_name' => 'Emergency Contact',
        'emergency_contact_phone' => '9876543210',
    ]);

    $response->assertOk()
        ->assertJson([
            'success' => true,
            'message' => 'Profile updated successfully.',
            'customer' => [
                'id' => $customer->id,
                'name' => 'Updated Name',
                'email' => 'updated@example.com',
                'gender' => 'female',
                'emergency_contact_name' => 'Emergency Contact',
            ],
        ]);

    $this->assertDatabaseHas('customers', [
        'id' => $customer->id,
        'name' => 'Updated Name',
        'email' => 'updated@example.com',
        'gender' => 'female',
    ]);
});

it('allows customer to upload profile photo', function () {
    Storage::fake('public');

    $customer = Customer::create([
        'name' => 'Photo User',
        'phone' => '9988776656',
        'password' => bcrypt('password'),
        'phone_verified_at' => now(),
        'is_active' => true,
    ]);
    Sanctum::actingAs($customer, ['*']);

    $file = UploadedFile::fake()->image('avatar.jpg', 300, 300);

    $response = $this->postJson('/api/customer-app/profile/photo', [
        'photo' => $file,
    ]);

    $response->assertOk()
        ->assertJson([
            'success' => true,
            'message' => 'Profile photo updated successfully.',
        ]);

    $customer->refresh();
    expect($customer->profile_photo)->not->toBeNull()
        ->and($customer->profile_photo_url)->not->toBeNull();

    Storage::disk('public')->assertExists($customer->profile_photo);
});

it('allows customer to upload profile photo as base64', function () {
    Storage::fake('public');

    $customer = Customer::create([
        'name' => 'Base64 User',
        'phone' => '9988776657',
        'password' => bcrypt('password'),
        'phone_verified_at' => now(),
        'is_active' => true,
    ]);
    Sanctum::actingAs($customer, ['*']);

    $dummyImage = base64_encode('fake image content');
    $response = $this->postJson('/api/customer-app/profile/photo', [
        'photo_base64' => 'data:image/jpeg;base64,' . $dummyImage,
    ]);

    $response->assertOk()
        ->assertJson([
            'success' => true,
            'message' => 'Profile photo updated successfully.',
        ]);

    $customer->refresh();
    expect($customer->profile_photo)->not->toBeNull();
    Storage::disk('public')->assertExists($customer->profile_photo);
});
