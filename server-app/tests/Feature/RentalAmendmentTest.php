<?php

namespace Tests\Feature;

use App\Models\CarCategory;
use App\Models\CarRental;
use App\Models\Customer;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RentalAmendmentTest extends TestCase
{
    use RefreshDatabase;

    private function createAdmin(): User
    {
        $admin = User::create([
            'name' => 'Admin Manager',
            'email' => 'admin.rental@example.com',
            'password' => bcrypt('password'),
        ]);
        $role = Role::firstOrCreate(['name' => 'admin'], ['display_name' => 'Admin']);
        $admin->roles()->attach($role);

        return $admin;
    }

    private function createRental(array $attrs = []): CarRental
    {
        $customer = Customer::firstOrCreate(['phone' => '9999999999'], ['name' => 'Test Customer', 'email' => 'cust@example.com']);
        $category = CarCategory::firstOrCreate(['slug' => 'sedan'], [
            'name' => 'Sedan',
            'vehicle_type' => 'sedan',
            'seats' => 4,
            'base_price_per_day' => 100,
        ]);

        $rental = CarRental::create(array_merge([
            'customer_id' => $customer->id,
            'car_category_id' => $category->id,
            'customer_name' => 'Test Customer',
            'customer_phone' => '9999999999',
            'customer_email' => 'cust@example.com',
            'pickup_location' => 'Pickup Location',
            'start_date' => now()->toDateString(),
            'end_date' => now()->addDays(2)->toDateString(),
            'number_of_days' => 2,
            'base_price' => 200.00,
            'total_price' => 200.00,
            'pricing_snapshot' => ['base_price_per_day' => 100],
            'status' => 'confirmed',
            'payment_status' => 'paid',
            'payment_method' => 'card',
        ], $attrs));
        if ($rental->payment_status === 'paid') {
            \App\Models\Payment::create(['provider' => 'razorpay', 'provider_payment_id' => 'pay_'.$rental->id,
                'payable_type' => CarRental::class, 'payable_id' => $rental->id,
                'amount_minor' => (int) ($rental->total_price * 100), 'currency' => 'INR', 'status' => 'captured', 'captured_at' => now()]);
        }

        return $rental;
    }

    public function test_preview_returns_price_delta_and_availability()
    {
        $admin = $this->createAdmin();
        $rental = $this->createRental();

        $response = $this->actingAs($admin)->postJson("/admin/car-rentals/{$rental->id}/amend-preview", [
            'end_date' => now()->addDays(4)->toDateString(),
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('data.additional_days', 2);
        $response->assertJsonPath('data.price_delta', 200); // 2 days * 100
        $response->assertJsonPath('data.available', true);
    }

    public function test_extension_adds_days_and_increases_price()
    {
        $admin = $this->createAdmin();
        $rental = $this->createRental(['payment_status' => 'pending']);

        $response = $this->actingAs($admin)->postJson("/admin/car-rentals/{$rental->id}/amend", [
            'end_date' => now()->addDays(4)->toDateString(),
        ]);

        $response->assertStatus(200);
        $rental->refresh();
        $this->assertEquals(4, $rental->number_of_days);
        $this->assertEquals(400.00, $rental->total_price);
        $this->assertEquals(now()->addDays(4)->toDateString(), $rental->end_date->toDateString());

        $this->assertDatabaseHas('booking_audit_logs', [
            'auditable_type' => CarRental::class,
            'auditable_id' => $rental->id,
            'action' => 'amended',
        ]);
    }

    public function test_reduction_removes_days_and_triggers_refund()
    {
        $admin = $this->createAdmin();
        $rental = $this->createRental([
            'end_date' => now()->addDays(4)->toDateString(),
            'number_of_days' => 4,
            'total_price' => 400.00,
        ]);

        $response = $this->actingAs($admin)->postJson("/admin/car-rentals/{$rental->id}/amend", [
            'end_date' => now()->addDays(2)->toDateString(),
        ]);

        $response->assertStatus(200);
        $rental->refresh();
        $this->assertEquals(2, $rental->number_of_days);
        $this->assertEquals(200.00, $rental->total_price);

        $this->assertDatabaseHas('booking_refunds', [
            'refundable_type' => CarRental::class,
            'refundable_id' => $rental->id,
            'amount' => 200.00,
        ]);
    }

    public function test_retry_does_not_repeat_an_amendment_and_keeps_audit_evidence()
    {
        $admin = $this->createAdmin();
        $rental = $this->createRental(['payment_status' => 'pending']);
        $params = ['end_date' => now()->addDays(4)->toDateString()];
        $service = app(\App\Services\CarRentalAmendmentService::class);
        $service->amend($rental, $params, $admin->id, 'same-intent');
        $service->amend($rental->fresh(), $params, $admin->id, 'same-intent');
        $this->assertEquals(1, $rental->auditLogs()->where('action', 'amended')->count());
        $this->assertEquals('same-intent', $rental->auditLogs()->first()->after['request_id']);
        $this->assertEquals('pending', $rental->fresh()->payment_status);
    }

    public function test_funded_extension_cannot_silently_add_uncollected_revenue()
    {
        $admin = $this->createAdmin();
        $rental = $this->createRental();
        try {
            app(\App\Services\CarRentalAmendmentService::class)->amend($rental,
                ['end_date' => now()->addDays(4)->toDateString()], $admin->id, 'funded-extension');
            $this->fail('Expected funded extension to require a balance-payment flow.');
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $error) {
            $this->assertEquals(422, $error->getStatusCode());
        }
        $this->assertEquals(200, $rental->fresh()->total_price);
        $this->assertEquals(0, $rental->auditLogs()->count());
    }

    public function test_missing_snapshot_cannot_create_free_extension()
    {
        $rental = $this->createRental(['pricing_snapshot' => null]);
        $this->expectException(\Symfony\Component\HttpKernel\Exception\HttpException::class);
        app(\App\Services\CarRentalAmendmentService::class)->preview($rental, ['end_date' => now()->addDays(4)->toDateString()]);
    }
}
