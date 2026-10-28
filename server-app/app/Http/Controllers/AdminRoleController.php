<?php

namespace App\Http\Controllers;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class AdminRoleController extends Controller
{
    /**
     * List all roles with user + permission counts.
     */
    public function index()
    {
        $roles = Role::withCount(['users', 'permissions'])
            ->with('permissions')
            ->paginate(15);

        return Inertia::render('admin/Roles/Index', [
            'title' => 'Roles & Permissions',
            'user' => Auth::user(),
            'roles' => $roles,
        ]);
    }

    /**
     * Show create role form.
     */
    public function create()
    {
        $allPermissions = Permission::orderBy('group')->orderBy('display_name')->get();
        $grouped = $allPermissions->groupBy('group')->toArray();

        return Inertia::render('admin/Roles/Create', [
            'title' => 'Create Role',
            'user' => Auth::user(),
            'permissions' => $allPermissions,
            'grouped_permissions' => $grouped,
        ]);
    }

    /**
     * Store new role.
     */
    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255|unique:roles,name|regex:/^[a-z_]+$/',
            'display_name' => 'required|string|max:255',
            'description' => 'nullable|string|max:500',
            'permissions' => 'nullable|array',
            'permissions.*' => 'integer|exists:permissions,id',
        ]);

        $role = Role::create([
            'name' => $request->name,
            'display_name' => $request->display_name,
            'description' => $request->description,
        ]);

        if ($request->permissions) {
            $role->permissions()->sync($request->permissions);
        }

        return redirect()->route('admin.roles.index')->with('success', 'Role created successfully.');
    }

    /**
     * Show role details (read-only).
     */
    public function show(Role $role)
    {
        $role->load(['permissions', 'users']);

        return Inertia::render('admin/Roles/Show', [
            'title' => 'Role Details',
            'user' => Auth::user(),
            'target_role' => $role,
        ]);
    }

    /**
     * Show edit form.
     */
    public function edit(Role $role)
    {
        $role->load('permissions');
        $allPermissions = Permission::orderBy('group')->orderBy('display_name')->get();
        $grouped = $allPermissions->groupBy('group')->toArray();

        return Inertia::render('admin/Roles/Edit', [
            'title' => 'Edit Role',
            'user' => Auth::user(),
            'target_role' => $role,
            'permissions' => $allPermissions,
            'grouped_permissions' => $grouped,
        ]);
    }

    /**
     * Update role.
     */
    public function update(Request $request, Role $role)
    {
        $request->validate([
            'name' => 'required|string|max:255|unique:roles,name,'.$role->id.'|regex:/^[a-z_]+$/',
            'display_name' => 'required|string|max:255',
            'description' => 'nullable|string|max:500',
            'permissions' => 'nullable|array',
            'permissions.*' => 'integer|exists:permissions,id',
        ]);

        $role->update([
            'name' => $request->name,
            'display_name' => $request->display_name,
            'description' => $request->description,
        ]);

        $role->permissions()->sync($request->permissions ?? []);

        return redirect()->route('admin.roles.index')->with('success', 'Role updated successfully.');
    }

    /**
     * Delete role (guards against deleting 'admin').
     */
    public function destroy(Role $role)
    {
        if (in_array($role->name, ['admin', 'super_admin'])) {
            return back()->with('error', 'The admin role cannot be deleted.');
        }

        $role->permissions()->detach();
        $role->users()->detach();
        $role->delete();

        return redirect()->route('admin.roles.index')->with('success', 'Role deleted successfully.');
    }
}
