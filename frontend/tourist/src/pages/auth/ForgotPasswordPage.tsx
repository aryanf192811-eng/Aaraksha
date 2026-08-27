// src/pages/auth/ForgotPasswordPage.tsx
// 3-step flow: Enter phone -> Verify OTP -> New password
import { useState, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { Shield, Loader2, ArrowLeft, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { PasswordInput } from '../../components/ui/password-input'
import { Label } from '../../components/ui/label'
import authApi from '../../api/auth.api'

const STEP_LABELS = ['Enter Phone', 'Verify OTP', 'New Password']

export default function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])   // 6-digit array
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [resendTimer, setResendTimer] = useState(0)
  const [debugOtp, setDebugOtp] = useState<string | null>(null)
  const otpRefs = useRef<Array<HTMLInputElement | null>>([])

  // Resend cooldown timer
  useEffect(() => {
    if (resendTimer <= 0) return
    const t = setInterval(() => setResendTimer(s => s - 1), 1000)
    return () => clearInterval(t)
  }, [resendTimer])

  // ── Step 1: Request OTP ─────────────────────────────────────────
  const { mutate: requestOTP, isPending: requesting } = useMutation({
    mutationFn: () => authApi.forgotPassword({ phone }),
    onSuccess: (res) => {
      toast.success('OTP sent to your registered phone')
      setDebugOtp(res.data.data?.debugOtp ?? null)
      setStep(2)
      setResendTimer(60)
    },
    onError: () => {
      // Anti-enumeration: even on error, advance (backend always returns 200)
      toast.success('If this number is registered, an OTP was sent')
      setStep(2)
      setResendTimer(60)
    },
    // The global queryClient default would otherwise also toast the real
    // error, undermining the anti-enumeration behavior above.
    meta: { suppressErrorToast: true },
  })

  // ── Step 2: Verify OTP ──────────────────────────────────────────
  const otpString = otp.join('')
  const { mutate: verifyOTP, isPending: verifying } = useMutation({
    mutationFn: () => authApi.verifyOTP({ phone, otp: otpString, purpose: 'PASSWORD_RESET' }),
    onSuccess: (res) => {
      setResetToken(res.data.data.resetToken)
      toast.success('OTP verified! Set your new password.')
      setStep(3)
    },
  })

  const { mutate: resendOTP } = useMutation({
    mutationFn: () => authApi.resendOTP({ phone, purpose: 'PASSWORD_RESET' }),
    onSuccess: (res) => {
      toast.success('OTP resent')
      setDebugOtp(res.data.data?.debugOtp ?? null)
      setResendTimer(60)
    },
  })

  // OTP input: auto-advance on digit entry, backspace handling
  const handleOTPChange = (idx: number, val: string) => {
    const digit = val.replace(/\D/g, '').slice(-1)
    const next = [...otp]
    next[idx] = digit
    setOtp(next)
    if (digit && idx < 5) otpRefs.current[idx + 1]?.focus()
  }
  const handleOTPKey = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[idx] && idx > 0) otpRefs.current[idx - 1]?.focus()
  }

  // ── Step 3: Reset Password ──────────────────────────────────────
  const { mutate: resetPwd, isPending: resetting } = useMutation({
    mutationFn: () => authApi.resetPassword({ resetToken, newPassword }),
    onSuccess: () => {
      toast.success('Password reset! Please log in.')
      navigate('/auth')
    },
  })

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Link to="/auth" className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface mb-8 text-sm font-medium">
          <ArrowLeft className="w-4 h-4" /> Back to login
        </Link>

        <div className="bg-surface-container-lowest rounded-3xl shadow-glass-lg border border-outline-variant/30 overflow-hidden">
          <div className="h-1.5 bg-primary" />
          <div className="p-8">
            {/* Brand */}
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="font-black text-on-surface">Reset Password</span>
            </div>

            {/* Step indicator */}
            <div className="flex gap-1.5 mb-6">
              {[1, 2, 3].map(s => (
                <div key={s} className={`h-1 flex-1 rounded-full transition-all ${s <= step ? 'bg-primary' : 'bg-surface-container-highest'}`} />
              ))}
            </div>
            <p className="text-sm text-on-surface-variant mb-6">Step {step}: {STEP_LABELS[step - 1]}</p>

            {/* ── Step 1 ── */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-black text-on-surface mb-1">Forgot your password?</h2>
                  <p className="text-sm text-on-surface-variant">Enter your registered mobile number. We'll send a 6-digit OTP.</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="font-semibold text-sm">Mobile Number</Label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-on-surface-variant">+91</span>
                    <Input type="tel" placeholder="9876543210" value={phone} onChange={e => setPhone(e.target.value)}
                      className="pl-12 h-12 rounded-xl" />
                  </div>
                </div>
                <Button disabled={requesting || phone.length < 10}
                  onClick={() => requestOTP()}
                  className="w-full h-12 bg-primary hover:brightness-95 text-on-surface rounded-full font-bold">
                  {requesting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Send OTP'}
                </Button>
              </div>
            )}

            {/* ── Step 2 ── */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-black text-on-surface mb-1">Enter the OTP</h2>
                  <p className="text-sm text-on-surface-variant">6-digit code sent to +91{phone}. Valid for 10 minutes.</p>
                </div>
                {debugOtp && (
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    Demo mode — SMS delivery is unavailable on this Twilio trial account. Code: <span className="font-mono font-bold">{debugOtp}</span>
                  </p>
                )}
                {/* OTP Input boxes */}
                <div className="flex gap-2 justify-center">
                  {otp.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={el => { otpRefs.current[idx] = el }}
                      type="text" inputMode="numeric" maxLength={1}
                      value={digit}
                      onChange={e => handleOTPChange(idx, e.target.value)}
                      onKeyDown={e => handleOTPKey(idx, e)}
                      className="w-11 h-14 text-center text-xl font-black border-2 rounded-xl
                        border-outline-variant focus:border-primary focus:outline-none
                        transition-colors bg-surface-container-lowest text-on-surface"
                    />
                  ))}
                </div>
                <Button
                  disabled={otpString.length < 6 || verifying}
                  onClick={() => verifyOTP()}
                  className="w-full h-12 bg-on-surface text-surface rounded-full font-bold">
                  {verifying ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify OTP'}
                </Button>
                <div className="text-center">
                  {resendTimer > 0 ? (
                    <p className="text-sm text-on-surface-variant">Resend OTP in {resendTimer}s</p>
                  ) : (
                    <button onClick={() => resendOTP()}
                      className="text-sm text-primary font-semibold hover:underline">
                      Resend OTP
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── Step 3 ── */}
            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-black text-on-surface mb-1">Set new password</h2>
                  <p className="text-sm text-on-surface-variant">Choose a strong password. Minimum 8 characters.</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="font-semibold text-sm">New Password</Label>
                  <PasswordInput showLockIcon={false} placeholder="Min 8 characters" value={newPassword}
                    onChange={e => setNewPassword(e.target.value)} className="h-12 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-semibold text-sm">Confirm Password</Label>
                  <PasswordInput showLockIcon={false} placeholder="Repeat password" value={confirm}
                    onChange={e => setConfirm(e.target.value)} className="h-12 rounded-xl" />
                </div>
                {confirm && newPassword !== confirm && (
                  <p className="text-xs text-red-500">Passwords do not match</p>
                )}
                <Button
                  disabled={newPassword.length < 8 || newPassword !== confirm || resetting}
                  onClick={() => resetPwd()}
                  className="w-full h-12 bg-on-surface text-surface rounded-full font-bold">
                  {resetting ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Lock className="w-4 h-4 mr-2" /> Reset Password</>}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
