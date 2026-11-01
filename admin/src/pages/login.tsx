import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { Button, ErrorNotice, Input } from '@/components/ui';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export function LoginPage() {
  const { session, login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('admin@clockin.test');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session) {
    return <Navigate to="/" replace />;
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (loginError) {
      setError(errorMessage(loginError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-white to-indigo-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-xl font-bold text-white">
            C
          </span>
          <h1 className="mt-3 text-2xl font-bold text-slate-900">
            ClockIn Admin
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Masuk untuk memantau kehadiran dan mengelola karyawan.
          </p>
        </div>

        <form
          onSubmit={(event) => void submit(event)}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Email</span>
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700">Password</span>
            <Input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </label>

          {error ? <ErrorNotice message={error} /> : null}

          <Button
            type="submit"
            className="w-full"
            disabled={submitting || !email || !password}>
            {submitting ? 'Memproses…' : 'Masuk'}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-500">
          Hanya akun dengan role Admin yang dapat mengakses dashboard ini.
        </p>
      </div>
    </div>
  );
}
