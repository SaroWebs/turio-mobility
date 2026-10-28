<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Driver;
use App\Models\Wallet;
use App\Services\OtpService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;

class DriverOtpController extends Controller
{
    public function __construct(protected OtpService $otpService) {}

    /**
     * Send OTP to phone number for login.
     */
    public function sendOtp(Request $request): JsonResponse
    {
        $request->validate([
            'phone' => 'required|string|min:10|max:20',
        ]);

        $phone = trim((string) $request->input('phone'));
        $result = $this->otpService->send($phone, 'driver');
        $driver = Driver::where('phone', $phone)->first();

        if ($result['success']) {
            $result['driver_exists'] = (bool) $driver;
            $result['driver_status'] = $driver?->status;
            $result['next_step'] = $driver ? 'verify_login' : 'verify_registration';
        }

        return response()->json($result, $result['success'] ? 200 : ($result['status_code'] ?? 429));
    }

    /**
     * Complete a driver profile after the phone number has been verified.
     */
    public function completeRegistration(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'registration_token' => 'required|string',
            'phone' => 'required|string|min:10|max:20|unique:drivers,phone',
            'name' => 'required|string|min:2|max:255',
            'email' => 'nullable|email|max:191|unique:drivers,email',
            'license_number' => 'nullable|string|max:100',
            'license_expiry' => 'nullable|date|after:today',
            'vehicle_type' => 'nullable|string|in:hatchback,sedan,suv,van,other',
            'vehicle_number' => 'nullable|string|max:50',
            'vehicle_model' => 'nullable|string|max:100',
            'service_types' => 'required|array|min:1',
            'service_types.*' => 'required|string|in:ride,tour,rental',
        ]);

        if (! $this->validRegistrationToken($validated['registration_token'], $validated['phone'])) {
            return response()->json([
                'success' => false,
                'message' => 'Registration session expired. Please request a new OTP.',
            ], 422);
        }

        $serviceTypes = array_values(array_unique($validated['service_types']));
        unset($validated['registration_token'], $validated['service_types']);

        $driver = Driver::create([
            ...$validated,
            'status' => 'pending',
            'is_active' => true,
            'is_approved' => false,
            'is_online' => false,
            'can_short_ride' => in_array('ride', $serviceTypes, true),
            'can_long_ride' => in_array('ride', $serviceTypes, true),
            'can_tour_lead' => false,
            'can_tour_transport' => in_array('tour', $serviceTypes, true),
            'can_rental_delivery' => in_array('rental', $serviceTypes, true),
            'phone_verified_at' => now(),
        ]);

        Wallet::firstOrCreate([
            'owner_type' => $driver::class,
            'owner_id' => $driver->id,
        ], [
            'balance' => 0,
            'currency' => 'INR',
            'is_active' => true,
        ]);

        $token = $this->issueToken($driver);

        return response()->json([
            'success' => true,
            'driver_created' => true,
            'driver_status' => $driver->status,
            'requires_profile' => false,
            'message' => 'Account created. Add your driver documents and car to complete setup.',
            'token' => $token,
            'driver' => $driver,
        ], 201);
    }

    /**
     * Verify OTP and issue Sanctum token.
     */
    public function verifyOtp(Request $request): JsonResponse
    {
        $request->validate([
            'phone' => 'required|string|min:10|max:20',
            'code' => 'required|string|size:6',
        ]);

        $phone = $request->input('phone');
        $code = $request->input('code');

        $result = $this->otpService->verify($phone, $code, 'driver');

        if (! $result['success']) {
            return response()->json($result, $result['status_code'] ?? 422);
        }

        $driver = Driver::where('phone', $phone)->first();

        if (! $driver) {
            return response()->json([
                'success' => true,
                'message' => 'OTP verified. Complete your driver profile.',
                'requires_profile' => true,
                'registration_token' => $this->registrationToken($phone),
            ]);
        }

        if (! $driver->is_active) {
            return response()->json([
                'success' => false,
                'message' => 'Driver account is inactive. Please contact admin.',
            ], 403);
        }

        if (! $driver->phone_verified_at) {
            $driver->forceFill(['phone_verified_at' => now()])->save();
        }

        $token = $this->issueToken($driver);

        return response()->json([
            'success' => true,
            'message' => 'Login successful.',
            'requires_profile' => false,
            'token' => $token,
            'driver' => $driver,
        ]);
    }

    /**
     * Get current authenticated driver.
     */
    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'driver' => $request->user()->load('vehicle.category'),
        ]);
    }

    /**
     * Logout — revoke current token.
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'success' => true,
            'message' => 'Logged out successfully.',
        ]);
    }

    private function issueToken(Driver $driver): string
    {
        $driver->tokens()->delete();

        return $driver->createToken(
            'driver-app',
            ['*'],
            now()->addMinutes((int) config('services.otp.token_expiration_minutes', 60 * 24 * 30))
        )->plainTextToken;
    }

    private function registrationToken(string $phone): string
    {
        return Crypt::encryptString(json_encode([
            'phone' => $phone,
            'expires_at' => now()->addMinutes(15)->timestamp,
        ]));
    }

    private function validRegistrationToken(string $token, string $phone): bool
    {
        try {
            $payload = json_decode(Crypt::decryptString($token), true, flags: JSON_THROW_ON_ERROR);
        } catch (\Throwable) {
            return false;
        }

        return ($payload['phone'] ?? null) === $phone
            && (int) ($payload['expires_at'] ?? 0) >= now()->timestamp;
    }
}
