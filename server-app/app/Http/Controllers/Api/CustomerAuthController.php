<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class CustomerAuthController extends Controller
{
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        if (! Auth::guard('customer')->attempt($credentials, true)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        $request->session()->regenerate();

        return response()->json([
            'success' => true,
            'customer' => Auth::guard('customer')->user(),
        ]);
    }

    public function register(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:customers,email'],
            'phone' => ['required', 'string', 'max:20', 'unique:customers,phone'],
            'password' => ['required', 'string', 'min:8'],
        ]);

        $customer = \App\Models\Customer::create($validated);

        Auth::guard('customer')->login($customer);
        $request->session()->regenerate();

        return response()->json([
            'success' => true,
            'customer' => $customer,
        ], 201);
    }

    public function logout(Request $request)
    {
        Auth::guard('customer')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json([
            'success' => true,
        ]);
    }

    public function me(Request $request)
    {
        return response()->json([
            'success' => true,
            'customer' => $request->user(),
        ]);
    }
}
