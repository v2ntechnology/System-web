/**
 * Ícones do RookHub — fonte única dos quatro painéis.
 *
 * ⚠️ **Nenhuma tela importa de `react-icons` direto.** Cada conceito do produto
 * tem um nome aqui, e é esse nome que as telas usam. É o que garante a regra que
 * originou este arquivo (decisão do usuário em 19/08/2026): a mesma ideia é o
 * mesmo desenho no painel do proprietário, do gestor, do operador e da
 * manutenção. Antes disso o sistema tinha duas bibliotecas, e "configurações"
 * era uma engrenagem diferente de cada lado.
 *
 * A família é a Lucide (`react-icons/lu`), traço de 2px em grade de 24. Trocar de
 * família é trocar os alvos deste arquivo, e nada mais.
 *
 * Para tipar uma prop que recebe um ícone, use `IconType` (reexportado abaixo).
 */
export type { IconType } from 'react-icons';

export {
  /* Navegação e estrutura ------------------------------------------------- */
  LuHouse as HomeIcon,
  LuMenu as MenuIcon,
  LuChevronDown as ChevronDownIcon,
  LuChevronUp as ChevronUpIcon,
  LuChevronLeft as ChevronLeftIcon,
  LuChevronRight as ChevronRightIcon,
  LuChevronsUpDown as ChevronsUpDownIcon,
  LuArrowUp as ArrowUpIcon,
  LuArrowDown as ArrowDownIcon,
  LuArrowLeft as ArrowLeftIcon,
  LuArrowRight as ArrowRightIcon,
  LuArrowUpRight as ArrowUpRightIcon,
  LuX as CloseIcon,
  LuSearch as SearchIcon,
  LuFilter as FilterIcon,
  LuExternalLink as ExternalLinkIcon,
  /* Editar um cadastro existente.
     ⚠️ `LuPencil`, o lápis sozinho, e NÃO `LuSquarePen`. Alinhado com o outro
     sistema do usuário em 30/08/2026, que documenta o motivo: em 16px a moldura
     do quadrado vira ruído ao lado da lixeira, que é um desenho aberto. */
  LuPencil as EditIcon,
  /* Excluir um registro gravado. */
  LuTrash as DeleteIcon,
  /* Esvaziar um formulário. A borracha, e não a lixeira: lixeira significa
     apagar um registro gravado, e usar o mesmo desenho para "zerar os campos"
     faria alguém achar que ia perder o cadastro. */
  LuEraser as EraserIcon,
  LuLayoutDashboard as DashboardIcon,
  LuLayoutGrid as GridIcon,
  LuInbox as InboxIcon,
  LuRefreshCw as RefreshIcon,

  /* Conta, sessão e preferências ------------------------------------------ */
  LuSettings as SettingsIcon,
  LuUserCog as UserSettingsIcon,
  LuLogOut as LogoutIcon,
  LuSun as SunIcon,
  LuMoon as MoonIcon,
  LuPalette as PaletteIcon,
  LuBell as BellIcon,
  LuLock as LockIcon,
  LuShieldCheck as ShieldCheckIcon,
  LuShieldAlert as ShieldAlertIcon,
  LuCreditCard as BillingIcon,
  LuPuzzle as ExtensionIcon,
  LuPlug as IntegrationIcon,
  LuBuilding2 as CompanyIcon,
  LuUser as UserIcon,
  LuUsers as UsersIcon,
  LuIdCard as IdCardIcon,
  LuPhone as PhoneIcon,
  LuBriefcase as BriefcaseIcon,
  LuCake as BirthdayIcon,
  LuGem as PlanIcon,
  LuLockOpen as UnlockIcon,
  LuPower as PowerIcon,
  LuEye as EyeIcon,
  LuEyeOff as EyeOffIcon,
  LuMonitor as MonitorIcon,

  /* Frota e operação ------------------------------------------------------- */
  LuTruck as TruckIcon,
  LuWrench as MaintenanceIcon,
  LuRoute as RouteIcon,
  LuMapPin as MapPinIcon,
  LuGauge as GaugeIcon,
  LuCircleParking as ParkingIcon,
  LuPackage as PackageIcon,
  LuBoxes as BoxesIcon,
  LuClipboardList as ChecklistIcon,
  LuClipboardCheck as ChecklistDoneIcon,
  LuNotebookPen as EntryIcon,
  LuFuel as FuelIcon,
  LuDroplet as DropletIcon,
  LuRadar as RadarIcon,
  LuSatellite as SatelliteIcon,
  LuWarehouse as WarehouseIcon,
  LuShipWheel as SteeringWheelIcon,
  LuCalendarCheck as CalendarCheckIcon,
  LuChartColumn as ChartBarIcon,
  LuCircleDollarSign as MoneyIcon,
  LuFileText as FileIcon,
  LuTarget as TargetIcon,
  LuGavel as ApprovalIcon,
  LuScrollText as ReportIcon,
  LuTable as TableIcon,
  LuRows3 as RowsIcon,
  LuChartLine as ChartIcon,
  LuCalendarDays as CalendarIcon,
  LuClock as ClockIcon,
  LuTimer as ClockCountdownIcon,
  LuRepeat as RepeatIcon,
  LuMedal as MedalIcon,
  LuBadgeCheck as BadgeCheckIcon,

  /* Estado e feedback ------------------------------------------------------ */
  LuCheck as CheckIcon,
  LuCircleCheckBig as CheckCircleIcon,
  LuTriangleAlert as WarningIcon,
  LuCircleAlert as AlertCircleIcon,
  LuCircleX as XCircleIcon,
  LuCircleMinus as MinusCircleIcon,
  LuBan as BlockedIcon,
  LuInfo as InfoIcon,
  LuTrendingUp as TrendUpIcon,
  LuTrendingDown as TrendDownIcon,
  LuLoaderCircle as SpinnerIcon,
  LuCircle as CircleIcon,
  LuPlus as PlusIcon,
  LuMinus as MinusIcon,

  /* Mídia, arquivos e IA --------------------------------------------------- */
  LuCamera as CameraIcon,
  LuVideo as VideoIcon,
  LuImage as ImageIcon,
  LuDownload as DownloadIcon,
  LuSave as SaveIcon,
  LuMail as MailIcon,
  LuSend as SendIcon,
  LuMic as MicIcon,
  LuMicOff as MicOffIcon,
  LuVolume2 as VolumeIcon,
  LuAudioLines as AudioWaveIcon,
  LuCirclePlay as PlayIcon,
  LuBot as BotIcon,
  LuBrainCircuit as AiIcon,
  LuSparkles as SparklesIcon,
  LuFlaskConical as DemoIcon,
  LuMessageCircle as ChatIcon,
  LuMessageSquareText as MessageIcon,
} from 'react-icons/lu';
