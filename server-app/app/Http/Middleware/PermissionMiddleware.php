<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class PermissionMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        $expectsJson = $request->expectsJson() || $request->is('api/*');

        // Check if user is authenticated
        if (! Auth::check()) {
            if ($expectsJson) {
                return response()->json(['error' => 'Unauthorized'], 401);
            }

            return redirect()->route('login');
        }

        $user = Auth::user();

        // Check if user has the required permission
        if (! $user->hasPermission($permission)) {
            if ($expectsJson) {
                return response()->json(['error' => 'Forbidden: Insufficient permissions'], 403);
            }

            return redirect()->route('admin.dashboard')->with('error', 'Forbidden: Insufficient permissions');
        }

        return $next($request);
    }
}
