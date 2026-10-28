<?php

use App\Models\Customer;
use App\Models\CustomerCoupon;
use App\Models\CustomerCouponRedemption;
use App\Models\Otp;
use App\Models\RideBooking;
use App\Models\WithdrawalRequest;
use App\Rules\FileIsClean;
use App\Services\CustomerCouponService;
use App\Services\OtpService;
use App\Services\Security\MalwareScanner;
use Illuminate\Http\UploadedFile;

/**
 * Threat-matrix regression tests (SKY-MRD-001 §12.1/§12.2).
 *
 * Each test pins the defensive control for one abuse vector so a future change
 * that quietly removes the guard fails here rather than in production:
 *  - coupon over-redemption (global usage_limit and per-customer race guard),
 *  - OTP brute-force (per-code attempt lockout, complements the route throttle),
 *  - withdrawal audit-field persistence (the $fillable data-loss fix),
 *  - malicious upload rejection (the malware scanner + FileIsClean rule).
 *
 * Webhook replay, duplicate-payment idempotency and refund-routing abuse are
 * covered by RazorpayWebhookTest, IdempotencyMiddlewareTest and
 * RefundLedgerRoutingTest respectively; single-debit overdraft and wallet
 * idempotency by WalletLedgerServiceTest — they are intentionally not repeated.
 */

// ---- helpers (uniquely named to avoid clashing with other test files) -------

function threatCustomer(string $name = 'Threat Tester'): Customer
{
    return Customer::create([
        'name' => $name,
        'phone' => '95'.random_int(10000000, 99999999),
    ]);
}

function threatRideBooking(Customer $customer): RideBooking
{
    return RideBooking::create([
        'customer_id' => $customer->id,
        'service_type' => 'point_to_point',
        'customer_name' => $customer->name,
        'customer_phone' => $customer->phone,
        'pickup_location' => 'Point A',
        'pickup_lat' => 12.9716,
        'pickup_lng' => 77.5946,
        'dropoff_location' => 'Point B',
        'dropoff_lat' => 12.9816,
        'dropoff_lng' => 77.6046,
        'scheduled_at' => now()->addDay(),
        'estimated_distance_km' => 10,
        'total_fare' => 2500,
        'status' => 'confirmed',
        'payment_status' => 'pending',
        'payment_method' => 'upi',
    ]);
}

/** Write bytes to a temp file, scan them, and always clean up. */
function threatScan(string $bytes): App\Services\Security\ScanResult
{
    $path = tempnam(sys_get_temp_dir(), 'sky_av_');
    file_put_contents($path, $bytes);

    try {
        return app(MalwareScanner::class)->scanFile($path);
    } finally {
        @unlink($path);
    }
}

/** Run the FileIsClean validation rule against bytes; return the failure messages. */
function threatValidateUpload(string $bytes, string $name): array
{
    $path = tempnam(sys_get_temp_dir(), 'sky_up_');
    file_put_contents($path, $bytes);

    // test-mode UploadedFile: getRealPath() returns $path and isValid() is true.
    $file = new UploadedFile($path, $name, null, null, true);

    $messages = [];
    try {
        (new FileIsClean)->validate('image', $file, function (string $message) use (&$messages) {
            $messages[] = $message;
        });
    } finally {
        @unlink($path);
    }

    return $messages;
}

// Malicious-upload samples below use executable/script magic bytes rather than
// the EICAR test string: a real host antivirus (e.g. Windows Defender) can
// quarantine an on-disk EICAR file before our scanner reads it, making the test
// flaky. Magic-byte samples drive the identical detection → rejection path with
// harmless, AV-neutral bytes.

// ---- coupon over-redemption -------------------------------------------------

it('stops a coupon at its global usage_limit even across different customers', function () {
    // usage_limit 1, per_customer_limit 0 so only the global cap is exercised.
    $coupon = CustomerCoupon::create([
        'code' => 'RACECAP',
        'name' => 'Global Cap',
        'discount_type' => 'fixed',
        'discount_value' => 100,
        'min_order_amount' => 0,
        'usage_limit' => 1,
        'per_customer_limit' => 0,
        'is_active' => true,
    ]);

    $service = app(CustomerCouponService::class);

    $c1 = threatCustomer('First');
    $service->redeem($c1, $coupon, threatRideBooking($c1), 'ride', 1000, 100);

    // The second redemption locks the coupon row, re-previews under the lock,
    // sees used_count(1) >= usage_limit(1) and refuses. Sequentially this is the
    // exact interleaving two concurrent redeemers collapse to once serialized.
    $c2 = threatCustomer('Second');
    $booking2 = threatRideBooking($c2);

    expect(fn () => $service->redeem($c2, $coupon, $booking2, 'ride', 1000, 100))
        ->toThrow(RuntimeException::class, 'usage limit');

    expect((int) $coupon->fresh()->used_count)->toBe(1)
        ->and(CustomerCouponRedemption::count())->toBe(1);
});

it('stops a coupon at its per-customer limit for a repeat redeemer', function () {
    // Unlimited globally; capped at one use per customer.
    $coupon = CustomerCoupon::create([
        'code' => 'RACEPER',
        'name' => 'Per Customer',
        'discount_type' => 'fixed',
        'discount_value' => 100,
        'min_order_amount' => 0,
        'usage_limit' => null,
        'per_customer_limit' => 1,
        'is_active' => true,
    ]);

    $service = app(CustomerCouponService::class);
    $customer = threatCustomer();

    $service->redeem($customer, $coupon, threatRideBooking($customer), 'ride', 1000, 100);

    $secondBooking = threatRideBooking($customer);
    expect(fn () => $service->redeem($customer, $coupon, $secondBooking, 'ride', 1000, 100))
        ->toThrow(RuntimeException::class, 'already used');

    expect((int) $coupon->fresh()->used_count)->toBe(1)
        ->and(CustomerCouponRedemption::where('customer_id', $customer->id)->count())->toBe(1);
});

// ---- OTP brute-force lockout (#15) -----------------------------------------

it('burns an OTP after the configured wrong-attempt cap and blocks further use', function () {
    config(['services.otp.max_verify_attempts' => 5]);
    $service = new OtpService; // constructor reads the cap from config

    Otp::create([
        'phone' => '9990001111',
        'type' => 'customer',
        'code' => '111111',
        'expires_at' => now()->addMinutes(5),
        'is_used' => false,
        'attempts' => 0,
    ]);

    // First four wrong guesses are merely rejected — no lockout yet.
    for ($i = 1; $i <= 4; $i++) {
        $result = $service->verify('9990001111', '000000', 'customer');
        expect($result['success'])->toBeFalse()
            ->and(array_key_exists('status_code', $result))->toBeFalse();
    }

    // The fifth wrong guess hits the cap: the code is burned and 429 returned.
    $fifth = $service->verify('9990001111', '000000', 'customer');
    expect($fifth['success'])->toBeFalse()
        ->and($fifth['status_code'])->toBe(429);

    expect((bool) Otp::where('phone', '9990001111')->first()->is_used)->toBeTrue();

    // Even the CORRECT code no longer works — the caller must request a fresh one.
    $correct = $service->verify('9990001111', '111111', 'customer');
    expect($correct['success'])->toBeFalse();
});

// ---- withdrawal audit-field persistence (guards the $fillable fix) ----------

it('persists the rejection reason and UTR on a withdrawal request', function () {
    $customer = threatCustomer();

    $rejected = WithdrawalRequest::create([
        'owner_type' => Customer::class,
        'owner_id' => $customer->id,
        'amount' => 1500,
        'method' => 'bank_transfer',
        'account_details' => ['account_number' => 'XXXX'],
        'status' => 'processing',
    ]);
    $rejected->reject(1, 'Bank details did not match KYC');

    // fresh() re-reads from the DB: before rejection_reason/utr_number were added
    // to $fillable, mass assignment silently dropped them and these were null.
    expect($rejected->fresh())
        ->status->toBe('rejected')
        ->rejection_reason->toBe('Bank details did not match KYC');

    $completed = WithdrawalRequest::create([
        'owner_type' => Customer::class,
        'owner_id' => $customer->id,
        'amount' => 2000,
        'method' => 'bank_transfer',
        'account_details' => ['account_number' => 'YYYY'],
        'status' => 'processing',
    ]);
    $completed->markAsCompleted('UTR1234567890');

    expect($completed->fresh())
        ->status->toBe('completed')
        ->utr_number->toBe('UTR1234567890');
});

// ---- malicious upload rejection (#11) --------------------------------------

it('detects executable and script magic bytes, and passes clean content', function () {
    config(['services.antivirus.driver' => 'heuristic', 'services.antivirus.fail_closed' => true]);

    // A Linux ELF binary header has no place in a media/document upload.
    $elf = threatScan("\x7fELF\x02\x01\x01\x00".'not a real binary, only the header');
    expect($elf->isInfected())->toBeTrue()
        ->and($elf->signature)->toBe('Heuristic.Executable.ELF');

    // A shell script smuggled in behind an image extension.
    $script = threatScan("#!/bin/sh\nrm -rf /\n");
    expect($script->isInfected())->toBeTrue()
        ->and($script->signature)->toBe('Heuristic.Script.Shebang');

    $clean = threatScan('just an ordinary photo caption, nothing dangerous here');
    expect($clean->isClean())->toBeTrue();
});

it('rejects a disguised executable at the validation boundary and allows a clean file', function () {
    config(['services.antivirus.driver' => 'heuristic', 'services.antivirus.fail_closed' => true]);

    // A Windows PE (starts with "MZ") uploaded as "avatar.png". FileIsClean runs
    // synchronously during validation, before the bytes are ever stored.
    $infected = threatValidateUpload("MZ\x90\x00\x03\x00\x00\x00malicious payload here", 'avatar.png');
    expect($infected)->toHaveCount(1)
        ->and($infected[0])->toContain('failed a security scan');

    $clean = threatValidateUpload('an entirely benign image caption', 'avatar.png');
    expect($clean)->toBeEmpty();
});
