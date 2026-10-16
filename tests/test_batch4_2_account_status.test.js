import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// 1. Simulation of Display Name & Initials Fallback Logic
function resolveDisplayName(user) {
    if (user?.fullName && user.fullName.trim().length > 0) {
        return user.fullName.trim();
    }
    if (user?.username && user.username.trim().length > 0) {
        return user.username.trim();
    }
    return 'Pengguna';
}

function resolveInitials(user) {
    const name = resolveDisplayName(user);
    return name.charAt(0).toUpperCase() || 'P';
}

function resolveIsAdmin(user) {
    return user?.role?.trim().toLowerCase() === 'admin';
}

function resolveSessionStatus(isAuthenticated, isRestoringSession, isConnected) {
    if (isRestoringSession) {
        return 'Memeriksa Sesi';
    }
    if (isAuthenticated) {
        return isConnected ? 'Sesi Aktif' : 'Sesi Aktif (Cache Lokal)';
    }
    return 'Sesi Berakhir';
}

function resolveIndicatorColor(isAuthenticated, isRestoringSession, isConnected) {
    if (isRestoringSession) {
        return 'neutral';
    }
    if (!isAuthenticated) {
        return 'urgent';
    }
    return isConnected ? 'success' : 'warning';
}

describe('Batch 4.2 — Indikator Login & Status Akun', () => {
    describe('Display Name Fallback Hierarchy', () => {
        test('fullName -> fullName used when present and non-empty', () => {
            const user = { fullName: 'Budi Santoso', username: 'budi123', role: 'student' };
            assert.equal(resolveDisplayName(user), 'Budi Santoso');
            assert.equal(resolveInitials(user), 'B');
        });

        test('fullName with whitespace only -> fallback to username', () => {
            const user = { fullName: '   ', username: 'budi123', role: 'student' };
            assert.equal(resolveDisplayName(user), 'budi123');
            assert.equal(resolveInitials(user), 'B');
        });

        test('fullName null -> fallback to username', () => {
            const user = { fullName: null, username: 'rio_dev', role: 'student' };
            assert.equal(resolveDisplayName(user), 'rio_dev');
            assert.equal(resolveInitials(user), 'R');
        });

        test('both fullName and username empty/null -> fallback to Pengguna', () => {
            const user = { fullName: null, username: '', role: 'student' };
            assert.equal(resolveDisplayName(user), 'Pengguna');
            assert.equal(resolveInitials(user), 'P');

            const nullUser = null;
            assert.equal(resolveDisplayName(nullUser), 'Pengguna');
            assert.equal(resolveInitials(nullUser), 'P');
        });
    });

    describe('Admin Role Badge Condition', () => {
        test('role "admin" -> true', () => {
            assert.equal(resolveIsAdmin({ role: 'admin' }), true);
        });

        test('role "Admin" / " ADMIN " (case-insensitive & trimmed) -> true', () => {
            assert.equal(resolveIsAdmin({ role: ' Admin ' }), true);
        });

        test('role "student", "user", null, undefined -> false', () => {
            assert.equal(resolveIsAdmin({ role: 'student' }), false);
            assert.equal(resolveIsAdmin({ role: 'user' }), false);
            assert.equal(resolveIsAdmin({ role: null }), false);
            assert.equal(resolveIsAdmin({}), false);
            assert.equal(resolveIsAdmin(null), false);
        });
    });

    describe('Session Status vs Network Status Separation', () => {
        test('Active session + online -> success dot, Sesi Aktif', () => {
            assert.equal(resolveSessionStatus(true, false, true), 'Sesi Aktif');
            assert.equal(resolveIndicatorColor(true, false, true), 'success');
        });

        test('Active session + offline -> warning dot, Sesi Aktif (Cache Lokal)', () => {
            assert.equal(resolveSessionStatus(true, false, false), 'Sesi Aktif (Cache Lokal)');
            assert.equal(resolveIndicatorColor(true, false, false), 'warning');
        });

        test('Session expired / logged out -> urgent dot, Sesi Berakhir', () => {
            assert.equal(resolveSessionStatus(false, false, true), 'Sesi Berakhir');
            assert.equal(resolveIndicatorColor(false, false, true), 'urgent');
        });

        test('Restoring session / initializing -> neutral dot, Memeriksa Sesi', () => {
            assert.equal(resolveSessionStatus(false, true, true), 'Memeriksa Sesi');
            assert.equal(resolveIndicatorColor(false, true, true), 'neutral');
        });
    });

    describe('SwiftUI Code Structure Verification', () => {
        test('UserAccountStatusBadge.swift exists and exports necessary structs', () => {
            const filePath = path.join(rootDir, 'Sources/TrackerThings/Views/Components/UserAccountStatusBadge.swift');
            assert.ok(fs.existsSync(filePath), 'UserAccountStatusBadge.swift must exist');
            const content = fs.readFileSync(filePath, 'utf8');
            assert.ok(content.includes('public struct UserAccountStatusBadge: View'));
            assert.ok(content.includes('public struct UserAccountSummarySheet: View'));
            assert.ok(content.includes('UserAvatarView('));
            assert.ok(content.includes('@Environment(AuthViewModel.self)'));
            assert.ok(content.includes('NetworkMonitor.shared.isConnected'));
            assert.ok(content.includes('AppTheme.Metrics.minTouchTarget'));
        });

        test('CourseListView.swift integrates account indicator and sheet', () => {
            const filePath = path.join(rootDir, 'Sources/TrackerThings/Views/Courses/CourseListView.swift');
            const content = fs.readFileSync(filePath, 'utf8');
            assert.ok(content.includes('@Environment(AuthViewModel.self) private var authViewModel'));
            assert.ok(content.includes('ToolbarItem(placement: .topBarLeading)'));
            assert.ok(content.includes('UserAccountStatusBadge(size: 30)'));
            assert.ok(content.includes('ToolbarItem(placement: .topBarTrailing)'));
            assert.ok(content.includes('.sheet(isPresented: $isShowingAccountSummary)'));
            assert.ok(content.includes('UserAccountSummarySheet()'));
            assert.ok(content.includes('.sheet(isPresented: $viewModel.isPresentingSheet)'));
        });

        test('RootTabView.swift passes authViewModel to CourseListView', () => {
            const filePath = path.join(rootDir, 'Sources/TrackerThings/Views/RootTabView.swift');
            const content = fs.readFileSync(filePath, 'utf8');
            assert.match(content, /CourseListView\(\s*viewModel:\s*courseViewModel/);
            assert.ok(content.includes('.environment(authViewModel)'));
        });
    });
});

