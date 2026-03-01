"use client";

import React, { useState, useEffect, useCallback } from "react";
import { functions } from "@/lib/firebase";
import { httpsCallable } from "firebase/functions";
import {
  Users,
  Shield,
  ShieldOff,
  Ban,
  CheckCircle2,
  Search,
  RefreshCw,
  Loader2,
  Phone,
  Mail,
  Clock,
  ShoppingCart,
  ChevronDown,
  ChevronUp,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface RegisteredUser {
  uid: string;
  email: string | null;
  phone: string | null;
  displayName: string | null;
  photoURL: string | null;
  createdAt: string | null;
  lastSignIn: string | null;
  disabled: boolean;
  isAdmin: boolean;
  orderCount: number;
  totalSpent: number;
}

interface ConfirmAction {
  type: "admin" | "disable";
  user: RegisteredUser;
  newValue: boolean;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function UsersTab() {
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedUid, setExpandedUid] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const listUsers = httpsCallable<unknown, { users: RegisteredUser[]; nextPageToken: string | null }>(
        functions,
        "listRegisteredUsers"
      );
      const result = await listUsers({ pageSize: 500 });
      setUsers(result.data.users || []);
    } catch (e) {
      console.error("[UsersTab] Failed to load users:", e);
      toast.error("Failed to load users.", {
        description: "Check admin permissions or try again.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleAdminToggle = async () => {
    if (!confirmAction || confirmAction.type !== "admin") return;
    const { user, newValue } = confirmAction;
    if (!user.email) {
      toast.error("User has no email address. Cannot set admin claim.");
      setConfirmAction(null);
      return;
    }

    setActionLoading(true);
    try {
      const setAdminClaim = httpsCallable<{ email: string; admin: boolean }, { success: boolean }>(
        functions,
        "setAdminClaim"
      );
      await setAdminClaim({ email: user.email, admin: newValue });
      setUsers((prev) =>
        prev.map((u) => (u.uid === user.uid ? { ...u, isAdmin: newValue } : u))
      );
      toast.success(newValue ? "Admin access granted." : "Admin access revoked.");
    } catch (e) {
      console.error("[UsersTab] Failed to update admin:", e);
      toast.error("Failed to update admin status.");
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  };

  const handleDisableToggle = async () => {
    if (!confirmAction || confirmAction.type !== "disable") return;
    const { user, newValue } = confirmAction;

    setActionLoading(true);
    try {
      const updateUserStatus = httpsCallable<{ uid: string; disabled: boolean }, { success: boolean }>(
        functions,
        "updateUserStatus"
      );
      await updateUserStatus({ uid: user.uid, disabled: newValue });
      setUsers((prev) =>
        prev.map((u) => (u.uid === user.uid ? { ...u, disabled: newValue } : u))
      );
      toast.success(newValue ? "User account disabled." : "User account enabled.");
    } catch (e) {
      console.error("[UsersTab] Failed to update user status:", e);
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast.error("Failed to update user status.", { description: msg });
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (u.displayName?.toLowerCase().includes(q)) ||
      (u.email?.toLowerCase().includes(q)) ||
      (u.phone?.includes(q)) ||
      (u.uid.toLowerCase().includes(q))
    );
  });

  const adminCount = users.filter((u) => u.isAdmin).length;
  const disabledCount = users.filter((u) => u.disabled).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Users className="w-6 h-6 text-slate-400" /> User Management
          <span className="text-sm font-normal text-slate-400">
            ({users.length} users)
          </span>
        </h2>
        <Button
          variant="secondary"
          size="sm"
          onClick={loadUsers}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
          <div className="text-2xl font-bold text-slate-800">{users.length}</div>
          <div className="text-xs text-slate-500 font-semibold">Total Users</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
          <div className="text-2xl font-bold text-emerald-700">{adminCount}</div>
          <div className="text-xs text-slate-500 font-semibold">Admins</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-3 text-center">
          <div className="text-2xl font-bold text-red-600">{disabledCount}</div>
          <div className="text-xs text-slate-500 font-semibold">Disabled</div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          type="text"
          placeholder="Search by name, email, phone, or UID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-12 text-slate-400 flex flex-col items-center gap-2">
          <Loader2 className="w-6 h-6 animate-spin" />
          Loading users...
        </div>
      )}

      {/* Empty */}
      {!loading && filteredUsers.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          {searchQuery ? "No users match your search." : "No users found."}
        </div>
      )}

      {/* User List */}
      {!loading &&
        filteredUsers.map((u) => {
          const isExpanded = expandedUid === u.uid;
          const displayName = u.displayName || u.email?.split("@")[0] || u.phone || "Unknown";
          const initials = displayName[0]?.toUpperCase() || "?";

          return (
            <div
              key={u.uid}
              className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-colors ${
                u.disabled ? "border-red-200 bg-red-50/30 opacity-75" : "border-slate-200"
              }`}
            >
              {/* User Row */}
              <button
                onClick={() => setExpandedUid(isExpanded ? null : u.uid)}
                className="w-full p-4 flex items-center gap-3 text-left hover:bg-slate-50 transition-colors"
              >
                {/* Avatar */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${
                    u.isAdmin ? "bg-emerald-600" : u.disabled ? "bg-red-400" : "bg-slate-400"
                  }`}
                >
                  {initials}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-800 truncate">
                      {displayName}
                    </span>
                    {u.isAdmin && (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-[10px]">
                        Admin
                      </Badge>
                    )}
                    {u.disabled && (
                      <Badge variant="destructive" className="text-[10px]">
                        Disabled
                      </Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 text-xs text-slate-500 mt-0.5">
                    {u.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3 h-3" /> {u.email}
                      </span>
                    )}
                    {u.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {u.phone}
                      </span>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="hidden md:flex items-center gap-4 text-sm shrink-0">
                  <div className="text-center">
                    <div className="font-bold text-slate-800">{u.orderCount}</div>
                    <div className="text-[10px] text-slate-400">Orders</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-emerald-700">
                      ₹{u.totalSpent.toLocaleString("en-IN")}
                    </div>
                    <div className="text-[10px] text-slate-400">Spent</div>
                  </div>
                </div>

                {/* Expand chevron */}
                {isExpanded ? (
                  <ChevronUp className="w-5 h-5 text-slate-400 shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
                )}
              </button>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="border-t border-slate-100 p-4 bg-slate-50 space-y-3">
                  {/* Detail Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-slate-400 font-semibold">UID</div>
                      <div className="font-mono text-xs text-slate-600 truncate">{u.uid}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Registered
                      </div>
                      <div className="text-slate-700">{formatDate(u.createdAt)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                        <UserCheck className="w-3 h-3" /> Last Sign In
                      </div>
                      <div className="text-slate-700">{formatDate(u.lastSignIn)}</div>
                    </div>
                    <div className="md:hidden">
                      <div className="text-xs text-slate-400 font-semibold flex items-center gap-1">
                        <ShoppingCart className="w-3 h-3" /> Orders / Spent
                      </div>
                      <div className="text-slate-700">
                        {u.orderCount} orders • ₹{u.totalSpent.toLocaleString("en-IN")}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200">
                    {u.isAdmin ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setConfirmAction({ type: "admin", user: u, newValue: false })
                        }
                        className="text-amber-600 border-amber-300 hover:bg-amber-50"
                      >
                        <ShieldOff className="w-3.5 h-3.5" /> Revoke Admin
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setConfirmAction({ type: "admin", user: u, newValue: true })
                        }
                        className="text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                      >
                        <Shield className="w-3.5 h-3.5" /> Grant Admin
                      </Button>
                    )}

                    {u.disabled ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setConfirmAction({ type: "disable", user: u, newValue: false })
                        }
                        className="text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Enable Account
                      </Button>
                    ) : (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() =>
                          setConfirmAction({ type: "disable", user: u, newValue: true })
                        }
                      >
                        <Ban className="w-3.5 h-3.5" /> Disable Account
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

      {/* Confirmation Dialog */}
      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "admin"
                ? confirmAction.newValue
                  ? "Grant Admin Access?"
                  : "Revoke Admin Access?"
                : confirmAction?.newValue
                ? "Disable User Account?"
                : "Enable User Account?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "admin"
                ? confirmAction.newValue
                  ? `This will grant admin privileges to ${confirmAction.user.displayName || confirmAction.user.email || "this user"}. They will be able to manage products, orders, and other users.`
                  : `This will revoke admin privileges from ${confirmAction.user.displayName || confirmAction.user.email || "this user"}. They will no longer be able to access the admin dashboard.`
                : confirmAction?.newValue
                ? `This will disable the account for ${confirmAction?.user.displayName || confirmAction?.user.email || "this user"}. They will not be able to sign in or place orders.`
                : `This will re-enable the account for ${confirmAction?.user.displayName || confirmAction?.user.email || "this user"}. They will be able to sign in and place orders again.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAction?.type === "admin" ? handleAdminToggle : handleDisableToggle}
              disabled={actionLoading}
              className={
                confirmAction?.type === "disable" && confirmAction.newValue
                  ? "bg-red-600 hover:bg-red-700"
                  : ""
              }
            >
              {actionLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                </>
              ) : (
                "Confirm"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
