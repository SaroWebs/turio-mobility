<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Guide;
use App\Services\OtpService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GuideOtpController extends Controller
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

        $phone = $request->input('phone');

        // Only pre-approved existing guides can log in
        $guide = Guide::where('phone', $phone)->first();
        if (! $guide) {
            return response()->json([
                'success' => false,
                'message' => 'No guide account found with this phone number. Please contact admin.',
            ], 404);
        }

        $result = $this->otpService->send($phone, 'guide');

        return response()->json($result, $result['success'] ? 200 : 429);
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

        $result = $this->otpService->verify($phone, $code, 'guide');

        if (! $result['success']) {
            return response()->json($result, $result['status_code'] ?? 422);
        }

        $guide = Guide::where('phone', $phone)->first();

        if (! $guide) {
            return response()->json([
                'success' => false,
                'message' => 'Guide account not found.',
            ], 404);
        }

        if (! $guide->is_active) {
            return response()->json([
                'success' => false,
                'message' => 'Guide account is inactive. Please contact admin.',
            ], 403);
        }

        if (! $guide->is_approved) {
            return response()->json([
                'success' => false,
                'message' => 'Guide account is pending approval.',
            ], 403);
        }

        // Revoke old tokens
        $guide->tokens()->delete();

        // Issue new Sanctum token
        $token = $guide->createToken('guide-app')->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Login successful.',
            'token' => $token,
            'guide' => $guide,
        ]);
    }

    /**
     * Get current authenticated guide.
     */
    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'success' => true,
            'guide' => $request->user(),
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
}
