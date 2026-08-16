import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  EnvelopeSimpleIcon,
  EyeIcon,
  EyeSlashIcon,
  InfoIcon,
  LockKeyIcon,
} from '@phosphor-icons/react';
import { forwardRef, useEffect, useRef, useState, type ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { z } from 'zod';

import { landingForRole, ROLE_LABELS } from '@/app/permissions';
import { GoogleMark } from '@/management/components/brand/google-mark';
import { RookhubLogo } from '@/management/components/brand/rookhub-logo';
import {
  Alert,
  AuroraBackdrop,
  Checkbox,
  GlassInput,
  Grainient,
  SpectrumButton,
  Spinner,
  useNoBlur,
  type GlassInputProps,
} from '@/management/ui';
import { DEMO_CREDENTIALS, DEMO_PASSWORD } from '@/mocks/session';
import { requestPasswordReset, signIn, signInWithGoogle } from '@/services/auth';
import { ApiError } from '@/services/http';
import { useSessionStore } from '@/stores/session-store';
import type { UserRole } from '@/types';

/*
 * Telas de acesso — layout portado do painel do monorepo `System-mobile`.
 *
 * ⚠️ Elas usam o design system do painel de gestão (vidro sobre grafite), então
 * ficam dentro de `.management-theme`: é a classe que troca os tokens em
 * conflito com o tema do System-web (ver `src/management/styles/theme.css`).
 */

/* -------------------------------------------------------------------------- */
/* Peças compartilhadas pelas três telas                                       */
/* -------------------------------------------------------------------------- */

type PasswordFieldProps = Omit<GlassInputProps, 'type' | 'trailing'>;

/** Campo de senha com alternância de visibilidade acessível. */
const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  function PasswordField(props, ref) {
    const [visible, setVisible] = useState(false);

    return (
      <GlassInput
        ref={ref}
        type={visible ? 'text' : 'password'}
        trailing={
          <button
            type="button"
            onClick={() => setVisible((current) => !current)}
            aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
            aria-pressed={visible}
            className="rounded-pill text-on-surface-muted hover:text-on-surface focus-visible:ring-secondary -mr-1 shrink-0 p-2 transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2"
          >
            {visible ? (
              <EyeSlashIcon size={20} weight="duotone" />
            ) : (
              <EyeIcon size={20} weight="duotone" />
            )}
          </button>
        }
        {...props}
      />
    );
  },
);

/**
 * Atalho de desenvolvimento: lista as contas mockadas disponíveis.
 * Some automaticamente no build de produção.
 */
function DemoCredentials({
  onSelect,
  disabled = false,
}: {
  onSelect: (email: string) => void;
  disabled?: boolean;
}) {
  if (import.meta.env.PROD) return null;

  return (
    <details className="glass-well text-label-md text-on-surface-muted group px-4 py-3 normal-case">
      <summary className="focus-visible:ring-secondary flex cursor-pointer list-none select-none items-center gap-2 rounded-sm focus-visible:outline-none focus-visible:ring-2">
        <InfoIcon size={16} weight="duotone" />
        <span className="flex-1">Acessar com uma conta de demonstração</span>
        <ArrowRightIcon className="transition-transform group-open:rotate-90" size={16} />
      </summary>
      <ul className="border-outline-variant mt-3 grid gap-2 border-t pt-3 sm:grid-cols-2">
        {DEMO_CREDENTIALS.map(({ email, role }) => (
          <li key={role}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onSelect(email)}
              className="border-outline-variant hover:border-outline focus-visible:ring-secondary w-full rounded-md border bg-white/[0.03] px-3 py-2 text-left transition-colors hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50"
            >
              <span className="text-on-surface block font-semibold">{ROLE_LABELS[role]}</span>
              <span className="tabular text-on-surface-muted mt-0.5 block truncate">{email}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="text-label-sm text-on-surface-muted mt-3 normal-case">
        Os dados são preenchidos automaticamente. Senha padrão:{' '}
        <span className="tabular">{DEMO_PASSWORD}</span>.
      </p>
    </details>
  );
}

/**
 * Layout de duas colunas do login: painel de marca à esquerda, conteúdo à
 * direita. Abaixo de `lg` o painel some — é peça de marca e, no celular,
 * empurraria o formulário para baixo da dobra.
 */
function AuthLayout({ children }: { children: ReactNode }) {
  const noBlur = useNoBlur();

  return (
    <main className="management-theme bg-surface h-dvh overflow-hidden p-4 sm:p-6">
      <div className="grid h-full gap-4 sm:gap-6 lg:grid-cols-[1fr_34rem] lg:gap-12">
        {/*
         * Painel de marca. Superfície indigo com texto branco usa
         * `primary-strong` (#5457EE): o `primary` dá 4,47:1 com branco e reprova
         * AA por uma casa.
         */}
        <aside className="bg-primary-strong relative hidden min-w-0 flex-col justify-between overflow-hidden rounded-lg p-10 lg:flex">
          {/*
           * O gradiente é decoração: fica atrás do conteúdo e o `primary-strong`
           * continua embaixo como cor de base — é ele que aparece em
           * `:root.no-blur`, onde o canvas nem chega a montar.
           */}
          {noBlur ? null : (
            <Grainient
              className="absolute inset-0"
              color1="#8385F4"
              color2="#6366F1"
              color3="#06B6D4"
              timeSpeed={0.25}
              colorBalance={0}
              warpStrength={1}
              warpFrequency={5}
              warpSpeed={2}
              warpAmplitude={50}
              blendAngle={0}
              blendSoftness={0.05}
              rotationAmount={500}
              noiseScale={2}
              grainAmount={0.1}
              grainScale={2}
              grainAnimated={false}
              contrast={1.5}
              gamma={1}
              saturation={1}
              centerX={0}
              centerY={0}
              zoom={0.9}
            />
          )}

          {/*
           * Scrim do rodapé. O gradiente anima, então a cor atrás da copy não é
           * fixa: medido no canvas, o branco vai de 5,1:1 a 2,6:1 conforme a
           * faixa cyan passa pelo texto. O scrim fixa um piso escuro sob a copy.
           */}
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-[rgba(10,10,16,0.72)] via-[rgba(10,10,16,0.36)] to-transparent"
          />

          <RookhubLogo variant="mark" className="relative h-12 self-start" />

          <div className="relative">
            <p className="text-body-lg text-on-primary/80">Você pode facilmente</p>

            {/*
             * `ch` só vale a pena no elemento que carrega o tamanho da fonte: num
             * container em 16px ele mediria a linha do corpo, e o título quebrava
             * em cinco linhas dentro de um painel de 600px.
             */}
            <p className="font-sora text-on-primary mt-3 max-w-[18ch] text-balance text-[34px] font-bold leading-11">
              Acompanhar sua frota inteira com clareza e controle
            </p>
          </div>
        </aside>

        {/*
         * Coluna do conteúdo — centrada na própria coluna, não no viewport. O
         * `min-h-full` no filho permite centralizar e ainda assim rolar dentro da
         * coluna numa janela baixa: com `items-center` puro, o excesso sairia
         * pelo topo e o botão de entrar ficaria inalcançável.
         */}
        <section className="min-w-0 overflow-y-auto [scrollbar-width:none] lg:pr-10 [&::-webkit-scrollbar]:hidden">
          <div className="flex min-h-full items-center justify-center py-2">
            <div className="w-full max-w-110">{children}</div>
          </div>
        </section>
      </div>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* Login                                                                       */
/* -------------------------------------------------------------------------- */

const loginSchema = z.object({
  email: z.string().min(1, 'Informe seu e-mail.').pipe(z.email('E-mail inválido.')),
  password: z.string().min(1, 'Informe sua senha.'),
  rememberMe: z.boolean(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useSessionStore((state) => state.login);

  const [formError, setFormError] = useState<string | null>(null);
  const [ssoPending, setSsoPending] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    control,
    setFocus,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', rememberMe: false },
  });

  /** Rota que o usuário tentou acessar antes de ser barrado, quando houve uma. */
  const attempted = (location.state as { from?: string } | null)?.from;

  /**
   * Para onde ir depois de entrar.
   *
   * A rota barrada tem precedência: quem clicou num link de notificação espera
   * cair nele, não na hub. Sem ela, vale o destino do papel — proprietário e
   * gestor passam pela escolha entre IA e sistema; operador e manutenção entram
   * direto no painel operacional.
   */
  function enter(role: UserRole) {
    login({ role });
    navigate(attempted ?? landingForRole(role), { replace: true });
  }

  async function onSubmit(values: LoginFormValues) {
    setFormError(null);
    try {
      enter(await signIn({ email: values.email, password: values.password }));
    } catch (error) {
      setFormError(
        error instanceof ApiError
          ? error.message
          : 'Não foi possível entrar agora. Tente novamente em instantes.',
      );
    }
  }

  async function onGoogleSignIn() {
    setFormError(null);
    setSsoPending(true);
    try {
      enter(await signInWithGoogle());
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Falha no login com o Google.');
    } finally {
      setSsoPending(false);
    }
  }

  const busy = isSubmitting || ssoPending;

  useEffect(() => {
    if (formError) errorRef.current?.focus();
  }, [formError]);

  function fillDemoCredentials(email: string) {
    setFormError(null);
    setValue('email', email, { shouldDirty: true, shouldValidate: true });
    setValue('password', DEMO_PASSWORD, { shouldDirty: true, shouldValidate: true });
    setFocus('email');
  }

  return (
    <AuthLayout>
      <header>
        <RookhubLogo variant="mark" className="h-10" />

        <h1 className="font-sora text-on-surface mt-6 text-balance text-[28px] font-bold leading-9 sm:text-[32px] sm:leading-10">
          Bem-vindo de volta
        </h1>

        <p className="text-body-md text-on-surface-variant mt-2">
          Acesse suas viagens, veículos e equipe a qualquer hora, tudo em um só lugar.
        </p>
      </header>

      <div className="mt-8">
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          autoComplete="on"
          className="flex flex-col gap-5"
        >
          {formError ? (
            <div
              ref={errorRef}
              tabIndex={-1}
              className="focus-visible:ring-error rounded-md focus-visible:outline-none focus-visible:ring-2"
            >
              <Alert severity="error">{formError}</Alert>
            </div>
          ) : null}

          <GlassInput
            label="E-mail"
            pill
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="nome@empresa.com.br"
            leading={<EnvelopeSimpleIcon size={20} weight="duotone" aria-hidden="true" />}
            autoFocus
            disabled={busy}
            error={errors.email?.message}
            {...register('email')}
          />

          <PasswordField
            label="Senha"
            pill
            autoComplete="current-password"
            placeholder="Digite sua senha"
            leading={<LockKeyIcon size={20} weight="duotone" aria-hidden="true" />}
            disabled={busy}
            error={errors.password?.message}
            {...register('password')}
          />

          {/* Empilha no mobile: lado a lado, os dois rótulos quebram em duas linhas. */}
          <div className="flex flex-col items-start gap-3 px-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <Controller
              control={control}
              name="rememberMe"
              render={({ field }) => (
                <Checkbox
                  label="Manter conectado"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  disabled={busy}
                />
              )}
            />

            <Link
              to="/esqueci-minha-senha"
              className="text-body-md text-on-surface-variant hover:text-on-surface focus-visible:ring-secondary focus-visible:ring-offset-background rounded-sm underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-4"
            >
              Esqueci minha senha
            </Link>
          </div>

          <SpectrumButton
            type="submit"
            variant="bright"
            shape="pill"
            size="xl"
            block
            disabled={busy}
            className="mt-2 hover:bg-light"
          >
            {isSubmitting ? (
              <>
                <Spinner label="Entrando" />
                Entrando…
              </>
            ) : (
              'Entrar'
            )}
          </SpectrumButton>

          <div className="my-3 flex items-center gap-4" aria-hidden="true">
            <span className="bg-outline-variant h-px flex-1" />
            <span className="text-label-sm text-on-surface-muted uppercase">ou</span>
            <span className="bg-outline-variant h-px flex-1" />
          </div>

          <SpectrumButton
            variant="ghost"
            shape="pill"
            size="xl"
            block
            onClick={onGoogleSignIn}
            disabled={busy}
          >
            {ssoPending ? <Spinner label="Conectando" /> : <GoogleMark className="h-5 w-5" />}
            Continuar com Google
          </SpectrumButton>

          <DemoCredentials onSelect={fillDemoCredentials} disabled={busy} />
        </form>

        <p className="border-outline-variant text-body-md text-on-surface-variant mt-7 border-t pt-6 text-center">
          Ainda não usa o RookHub?{' '}
          <a
            href="https://rookhub.com.br"
            className="text-on-surface hover:text-secondary focus-visible:ring-secondary focus-visible:ring-offset-background rounded-sm font-semibold underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-4"
          >
            Fale com nosso time
          </a>
        </p>
      </div>

      <footer className="text-label-md text-on-surface-variant mt-8 text-center normal-case">
        © {new Date().getFullYear()} RookHub · Gestão inteligente de frotas
      </footer>
    </AuthLayout>
  );
}

/* -------------------------------------------------------------------------- */
/* Recuperar senha                                                             */
/* -------------------------------------------------------------------------- */

const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Informe seu e-mail.').pipe(z.email('E-mail inválido.')),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  async function onSubmit(values: ForgotPasswordFormValues) {
    await requestPasswordReset(values.email);
    setSent(true);
  }

  return (
    <main className="management-theme bg-surface relative flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <AuroraBackdrop />

      <div className="w-full max-w-105">
        {sent ? (
          <div className="flex flex-col items-center text-center">
            <span className="rounded-pill bg-success/15 text-success flex h-14 w-14 items-center justify-center">
              <EnvelopeSimpleIcon size={26} weight="duotone" />
            </span>
            <h1 className="font-sora text-on-surface mt-7 text-[32px] font-bold leading-10">
              Verifique seu e-mail
            </h1>
            <p className="text-body-lg text-on-surface-variant mt-3">
              Se houver uma conta associada a esse endereço, enviamos um link para redefinir a
              senha. O link expira em 30 minutos.
            </p>
          </div>
        ) : (
          <>
            <header className="flex flex-col items-center text-center">
              <RookhubLogo variant="mark" />
              <h1 className="font-sora text-on-surface mt-7 text-[32px] font-bold leading-10">
                Recuperar acesso
              </h1>
              <p className="text-body-lg text-on-surface-variant mt-3">
                Informe seu e-mail e enviaremos um link para criar uma nova senha.
              </p>
            </header>

            <form
              onSubmit={handleSubmit(onSubmit)}
              noValidate
              className="mt-10 flex flex-col gap-4"
            >
              <Alert severity="info">
                Nesta versão o envio é simulado — nenhum e-mail sai de fato.
              </Alert>

              <GlassInput
                label="E-mail"
                hideLabel
                pill
                type="email"
                autoComplete="email"
                placeholder="Seu e-mail"
                autoFocus
                disabled={isSubmitting}
                error={errors.email?.message}
                {...register('email')}
              />

              <SpectrumButton
                type="submit"
                variant="bright"
                shape="pill"
                size="xl"
                block
                disabled={isSubmitting}
                className="mt-2"
              >
                {isSubmitting ? (
                  <>
                    <Spinner label="Enviando" />
                    Enviando…
                  </>
                ) : (
                  'Enviar link de recuperação'
                )}
              </SpectrumButton>
            </form>
          </>
        )}

        <div className="mt-8 flex justify-center">
          <Link
            to="/"
            className="text-body-md text-on-surface-variant hover:text-on-surface focus-visible:ring-secondary focus-visible:ring-offset-background inline-flex items-center gap-2 rounded-sm underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-4"
          >
            <ArrowLeftIcon size={16} weight="bold" />
            Voltar para o login
          </Link>
        </div>
      </div>
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* Convite                                                                     */
/* -------------------------------------------------------------------------- */

const inviteSchema = z
  .object({
    name: z.string().min(3, 'Informe seu nome completo.'),
    password: z.string().min(6, 'A senha deve ter ao menos 6 caracteres.'),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: 'As senhas não coincidem.',
    path: ['confirm'],
  });

type InviteFormValues = z.infer<typeof inviteSchema>;

export function InvitePage() {
  const { token } = useParams();
  const login = useSessionStore((state) => state.login);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { name: '', password: '', confirm: '' },
  });

  async function onSubmit() {
    /* Convite mockado: o perfil viria no token. Entra como gestor. */
    await new Promise((resolve) => setTimeout(resolve, 500));
    login({ role: 'MANAGER' });
    navigate(landingForRole('MANAGER'), { replace: true });
  }

  return (
    <AuthLayout>
      <header>
        <RookhubLogo variant="mark" className="h-10" />
        <h1 className="font-sora text-on-surface mt-6 text-[28px] font-bold leading-9">
          Você foi convidado
        </h1>
        <p className="text-body-md text-on-surface-variant mt-2">
          Complete seu cadastro para acessar a plataforma RookHub.
        </p>
        <p className="text-label-sm text-on-surface-muted mt-1 break-all normal-case">
          Convite: {token}
        </p>
      </header>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 flex flex-col gap-5">
        <GlassInput
          label="Nome completo"
          pill
          autoComplete="name"
          placeholder="Como você assina"
          autoFocus
          disabled={isSubmitting}
          error={errors.name?.message}
          {...register('name')}
        />

        <PasswordField
          label="Senha"
          pill
          autoComplete="new-password"
          placeholder="Crie uma senha"
          leading={<LockKeyIcon size={20} weight="duotone" aria-hidden="true" />}
          disabled={isSubmitting}
          error={errors.password?.message}
          {...register('password')}
        />

        <PasswordField
          label="Confirmar senha"
          pill
          autoComplete="new-password"
          placeholder="Repita a senha"
          leading={<LockKeyIcon size={20} weight="duotone" aria-hidden="true" />}
          disabled={isSubmitting}
          error={errors.confirm?.message}
          {...register('confirm')}
        />

        <SpectrumButton
          type="submit"
          variant="bright"
          shape="pill"
          size="xl"
          block
          disabled={isSubmitting}
          className="mt-2"
        >
          {isSubmitting ? (
            <>
              <Spinner label="Criando conta" />
              Criando conta…
            </>
          ) : (
            'Criar conta e acessar'
          )}
        </SpectrumButton>
      </form>
    </AuthLayout>
  );
}
