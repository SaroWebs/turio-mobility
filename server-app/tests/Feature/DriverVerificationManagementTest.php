<?php

use App\Models\Driver;
use App\Models\DriverDocument;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

function verificationAdmin(): User
{
    $admin = User::create([
        'name' => 'Verification Admin',
        'email' => 'verification-'.uniqid().'@example.com',
        'password' => 'password',
    ]);
    $role = Role::firstOrCreate(
        ['name' => 'admin'],
        ['display_name' => 'Administrator']
    );
    $admin->roles()->syncWithoutDetaching([$role->id]);

    return $admin;
}

function pendingVerificationDriver(): Driver
{
    return Driver::create([
        'name' => 'Pending Verification Driver',
        'phone' => '87'.random_int(10000000, 99999999),
        'status' => 'pending',
        'is_active' => true,
        'is_approved' => false,
    ]);
}

it('accepts required driver documents and reports verification progress', function () {
    Storage::fake('local');
    $driver = pendingVerificationDriver();
    Sanctum::actingAs($driver);

    $this->post('/api/driver-app/documents', [
        'type' => 'driving_license',
        'consent' => true,
        'document_number' => 'DL-12345',
        'file' => UploadedFile::fake()->create('licence.pdf', 100, 'application/pdf'),
    ])->assertOk()
        ->assertJsonPath('data.status', 'pending');

    $this->getJson('/api/driver-app/documents')
        ->assertOk()
        ->assertJsonPath('verification.is_complete', false)
        ->assertJsonCount(3, 'verification.required_types');
});

it('requires approved documents before activating a driver', function () {
    $admin = verificationAdmin();
    $driver = pendingVerificationDriver();

    $this->actingAs($admin)
        ->post("/admin/drivers/{$driver->id}/approve")
        ->assertSessionHasErrors('documents');

    foreach (['driving_license', 'government_id', 'vehicle_rc'] as $type) {
        DriverDocument::create([
            'driver_id' => $driver->id,
            'type' => $type,
            'file_path' => "driver-documents/{$driver->id}/{$type}.pdf",
            'status' => 'approved',
        ]);
    }

    $this->actingAs($admin)
        ->post("/admin/drivers/{$driver->id}/approve")
        ->assertRedirect();

    expect($driver->fresh()->status)->toBe('active')
        ->and($driver->fresh()->is_approved)->toBeTrue();
});

it('supports soft delete, restore and permanent delete for drivers', function () {
    $admin = verificationAdmin();
    $driver = pendingVerificationDriver();

    $this->actingAs($admin)
        ->delete("/admin/drivers/{$driver->id}")
        ->assertRedirect('/admin/drivers');
    $this->assertSoftDeleted('drivers', ['id' => $driver->id]);

    $this->actingAs($admin)
        ->post("/admin/drivers/deleted/{$driver->id}/restore")
        ->assertRedirect();
    $this->assertDatabaseHas('drivers', ['id' => $driver->id, 'deleted_at' => null]);

    $driver->delete();
    $this->actingAs($admin)
        ->delete("/admin/drivers/deleted/{$driver->id}/force")
        ->assertRedirect();
    $this->assertDatabaseMissing('drivers', ['id' => $driver->id]);
});
