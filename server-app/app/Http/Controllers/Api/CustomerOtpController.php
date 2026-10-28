<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Customer;
use App\Models\Wallet;
use App\Rules\FileIsClean;
use App\Services\OtpService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class CustomerOtpController extends Controller
{
    public function __construct(protected OtpService $otpService) {}

    /**
     * Send OTP to phone number for login/register as customer.
     */
    public function sendOtp(Request $request): JsonResponse
    {
        $request->validate([
            'phone' => 'required|string|min:10|max:20',
            'action' => 'in:login,register',
        ]);

        $phone = $request->input('phone');
        $action = $request->input('action', 'login');

        $result = $this->otpService->send($phone, 'customer');
        $customer = Customer::where('phone', $phone)->first();
        $result['customer_exists'] = (bool) $customer;
        $result['next_step'] = $customer ? 'verify_login' : 'verify_registration';

        return response()->json($result, $result['success'] ? 200 : ($result['status_code'] ?? 429));
    }

    /**
     * Verify OTP and issue Sanctum token.
     */
    public function verifyOtp(Request $request): JsonResponse
    {
        $request->validate([
            'phone' => 'required|string|min:10|max:20',
            'code' => 'required|string|size:6',
            'action' => 'in:login,register',
            'name' => 'nullable|string|max:255',
            'email' => 'nullable|email|max:255',
        ]);

        $phone = $request->input('phone');
        $code = $request->input('code');
        $action = $request->input('action', 'login');

        $result = $this->otpService->verify($phone, $code, 'customer');

        if (! $result['success']) {
            return response()->json($result, $result['status_code'] ?? 422);
        }

        $customer = Customer::where('phone', $phone)->first();

        if (! $customer) {
            return response()->json([
                'success' => true,
                'message' => 'OTP verified. Complete your customer profile to register.',
                'requires_registration' => true,
                'registration_token' => $this->registrationToken($phone),
            ]);
        }

        $token = $this->issueToken($customer);

        return response()->json([
            'success' => true,
            'message' => 'Login successful.',
            'requires_registration' => false,
            'token' => $token,
            'customer' => $customer,
        ]);
    }

    public function completeRegistration(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'phone' => 'required|string|min:10|max:20',
            'registration_token' => 'required|string',
            'name' => 'required|string|max:255',
            'email' => 'nullable|email|max:255',
        ]);

        if (! $this->validRegistrationToken($validated['registration_token'], $validated['phone'])) {
            return response()->json([
                'success' => false,
                'message' => 'Registration session expired. Please request a new OTP.',
            ], 422);
        }

        $customer = Customer::firstOrCreate(
            ['phone' => $validated['phone']],
            [
                'name' => $validated['name'],
                'email' => $validated['email'] ?? null,
                'password' => bcrypt(str()->random(32)),
                'phone_verified_at' => now(),
                'is_active' => true,
            ]
        );

        if (! $customer->wasRecentlyCreated) {
            $customer->forceFill([
                'name' => $customer->name ?: $validated['name'],
                'email' => $customer->email ?: ($validated['email'] ?? null),
                'phone_verified_at' => $customer->phone_verified_at ?? now(),
            ])->save();
        }

        Wallet::firstOrCreate([
            'owner_type' => get_class($customer),
            'owner_id' => $customer->id,
        ], [
            'balance' => 0,
            'currency' => 'INR',
            'is_active' => true,
        ]);

        $token = $this->issueToken($customer);

        return response()->json([
            'success' => true,
            'message' => $customer->wasRecentlyCreated ? 'Registration successful.' : 'Customer already exists. Logged in successfully.',
            'requires_registration' => false,
            'token' => $token,
            'customer' => $customer,
        ], $customer->wasRecentlyCreated ? 201 : 200);
    }

    /**
     * Get current authenticated customer.
     */
    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'customer' => $request->user(),
        ]);
    }

    /**
     * Update current customer's profile.
     */
    public function updateProfile(Request $request): JsonResponse
    {
        /** @var Customer $customer */
        $customer = $request->user();

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:120',
            'email' => 'nullable|email|max:120|unique:customers,email,'.$customer->id,
            'gender' => 'nullable|string|in:male,female,other',
            'date_of_birth' => 'nullable|date|before:today',
            'emergency_contact_name' => 'nullable|string|max:120',
            'emergency_contact_phone' => 'nullable|string|max:20',
            'photo' => ['nullable', 'image', 'mimes:jpeg,png,jpg,webp', 'max:5120', new FileIsClean],
            'profile_photo' => 'nullable|string|max:500',
            'profile_photo_url' => 'nullable|string|max:500',
        ]);

        if ($request->hasFile('photo')) {
            if ($customer->profile_photo && ! Str::startsWith($customer->profile_photo, ['http://', 'https://'])) {
                Storage::disk('public')->delete($customer->profile_photo);
            }
            $customer->profile_photo = $request->file('photo')->store('customer_avatars', 'public');
        } elseif ($request->filled('profile_photo_url')) {
            $customer->profile_photo = $request->input('profile_photo_url');
        } elseif ($request->filled('profile_photo') && is_string($request->input('profile_photo'))) {
            $customer->profile_photo = $request->input('profile_photo');
        }

        $customer->fill(collect($validated)->except(['photo', 'profile_photo_url'])->all());
        $customer->save();

        return response()->json([
            'success' => true,
            'message' => 'Profile updated successfully.',
            'customer' => $customer->fresh(),
        ]);
    }

    /**
     * Upload customer profile avatar.
     */
    public function uploadProfilePhoto(Request $request): JsonResponse
    {
        $hasFile = $request->hasFile('photo');
        $hasBase64 = $request->filled('photo_base64');

        if (! $hasFile && ! $hasBase64) {
            return response()->json([
                'success' => false,
                'message' => 'Please provide a photo file or base64 image data.',
                'errors' => [
                    'photo' => ['A photo file or base64 image is required.'],
                ],
            ], 422);
        }

        /** @var Customer $customer */
        $customer = $request->user();

        if ($hasFile) {
            $request->validate([
                'photo' => ['image', 'mimes:jpeg,png,jpg,webp', 'max:5120', new FileIsClean],
            ]);
            $path = $request->file('photo')->store('customer_avatars', 'public');
        } else {
            $base64Data = (string) $request->input('photo_base64');
            if (preg_match('/^data:image\/(\w+);base64,/', $base64Data, $matches)) {
                $ext = strtolower($matches[1]);
                $extension = in_array($ext, ['jpeg', 'jpg', 'png', 'webp']) ? ($ext === 'jpeg' ? 'jpg' : $ext) : 'jpg';
                $base64Data = substr($base64Data, strpos($base64Data, ',') + 1);
            } else {
                $extension = 'jpg';
            }

            $decoded = base64_decode($base64Data, true);
            if ($decoded === false || strlen($decoded) === 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid base64 image data.',
                    'errors' => ['photo_base64' => ['The provided image data is invalid.']],
                ], 422);
            }

            if (strlen($decoded) > 5 * 1024 * 1024) {
                return response()->json([
                    'success' => false,
                    'message' => 'Image size exceeds 5MB limit.',
                    'errors' => ['photo_base64' => ['Image must be under 5MB.']],
                ], 422);
            }

            $filename = 'customer_avatars/' . Str::random(40) . '.' . $extension;
            Storage::disk('public')->put($filename, $decoded);
            $path = $filename;
        }

        if ($customer->profile_photo && ! Str::startsWith($customer->profile_photo, ['http://', 'https://'])) {
            Storage::disk('public')->delete($customer->profile_photo);
        }

        $customer->profile_photo = $path;
        $customer->save();

        return response()->json([
            'success' => true,
            'message' => 'Profile photo updated successfully.',
            'profile_photo_url' => $customer->profile_photo_url,
            'customer' => $customer->fresh(),
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

    private function issueToken(Customer $customer): string
    {
        $customer->tokens()->delete();

        return $customer->createToken(
            'customer-app',
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
