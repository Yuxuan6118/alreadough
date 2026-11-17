// AlreaDough desktop pet for Windows: the same dough as the Mac pet (desktop-pet/main.swift), floating on the desktop.
// The motion is a port of the Mac version, which is itself a port of the web dough (LivingDough.tsx, .pet-* in already.css):
//
//   idle         slow breathing, little proofing specks rise now and then
//   click        squish and bounce, a ripple ring and 14 pieces of confetti
//   pull         drag it and it stretches like dough, let go and it springs back
//   pull far     keep pulling past the stretch limit and it breaks free and follows you; drop it anywhere
//   hold, move   or hold 0.4 s without moving, then drag: the same pick-up (it remembers the spot)
//   wheel        mouse wheel or a touchpad pinch on it: it grows or shrinks and springs back
//   3 quick taps a proofing party: it puffs up and bursts into confetti
//   nap          untouched for 90 s it dozes, slower breathing and drifting z; point at it to wake it
//   double-click opens AlreaDough in the browser
//   right-click  hide for a while, size, start with Windows, open AlreaDough, quit
//   full screen  when an app fills the screen (a film, a game, a presentation) the dough fades out and comes back after
//   tray icon    a small dough lives next to the clock, so a hidden dough can always be called back
//
// Drawing: one layered window, redrawn into a 32-bit premultiplied bitmap and handed to UpdateLayeredWindow, so the
// dough has real soft edges and a soft shadow. Only the dough itself takes the mouse; the rest of the window lets
// clicks through to whatever is underneath.

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

namespace AlreaDoughPet
{
    internal static class Program
    {
        internal const string SiteUrl = "https://alreadough.com/app";

        [STAThread]
        private static void Main()
        {
            try { Native.SetProcessDPIAware(); } catch { /* the manifest says so too */ }
            bool first;
            using (var mutex = new Mutex(true, "AlreaDoughPet-SingleInstance", out first))
            using (var comeBack = new EventWaitHandle(false, EventResetMode.AutoReset, "AlreaDoughPet-ComeBack"))
            {
                // opened a second time: the running dough comes back (from hiding) instead of a second dough appearing
                if (!first) { comeBack.Set(); return; }
                Log.Start();
                Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
                Application.ThreadException += (s, e) => Log.Write(e.Exception);
                AppDomain.CurrentDomain.UnhandledException += (s, e) => Log.Write(e.ExceptionObject);
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                try { Application.Run(new PetContext(comeBack)); }
                catch (Exception error) { Log.Write(error); }
                GC.KeepAlive(mutex);
            }
        }

        internal static void OpenSite()
        {
            try { Process.Start(new ProcessStartInfo(SiteUrl) { UseShellExecute = true }); }
            catch (Exception error) { Log.Write(error); }
        }
    }

    /// <summary>Errors go to %LOCALAPPDATA%\AlreaDough\pet.log, so a problem on someone's PC can be read later.</summary>
    internal static class Log
    {
        private static string path;
        public static void Start()
        {
            try
            {
                var folder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "AlreaDough");
                Directory.CreateDirectory(folder);
                path = Path.Combine(folder, "pet.log");
                if (File.Exists(path) && new FileInfo(path).Length > 200000) File.Delete(path);
            }
            catch { path = null; }
        }
        public static void Write(object message)
        {
            if (path == null || message == null) return;
            try { File.AppendAllText(path, DateTime.Now.ToString("s", CultureInfo.InvariantCulture) + " " + message + Environment.NewLine); }
            catch { /* nowhere to report it */ }
        }
    }

    /// <summary>Chinese on a Chinese Windows, English everywhere else.</summary>
    internal static class T
    {
        private static readonly bool Chinese = CultureInfo.CurrentUICulture.TwoLetterISOLanguageName == "zh";
        public static string S(string chinese, string english) => Chinese ? chinese : english;
    }

    /// <summary>Settings live in HKCU\Software\AlreaDough\Pet; nothing needs admin rights.</summary>
    internal static class Settings
    {
        private const string KeyPath = @"Software\AlreaDough\Pet";
        private const string RunPath = @"Software\Microsoft\Windows\CurrentVersion\Run";
        private const string RunName = "AlreaDough Pet";

        public static bool Has(string name)
        {
            try { using (var key = Registry.CurrentUser.OpenSubKey(KeyPath)) return key?.GetValue(name) != null; }
            catch { return false; }
        }
        public static double Get(string name, double fallback)
        {
            try
            {
                using (var key = Registry.CurrentUser.OpenSubKey(KeyPath))
                {
                    var text = key?.GetValue(name) as string;
                    double value;
                    return text != null && double.TryParse(text, NumberStyles.Float, CultureInfo.InvariantCulture, out value) ? value : fallback;
                }
            }
            catch { return fallback; }
        }
        public static void Set(string name, double value)
        {
            try { using (var key = Registry.CurrentUser.CreateSubKey(KeyPath)) key?.SetValue(name, value.ToString("R", CultureInfo.InvariantCulture)); }
            catch (Exception error) { Log.Write(error); }
        }
        public static void Remove(string name)
        {
            try { using (var key = Registry.CurrentUser.OpenSubKey(KeyPath, true)) key?.DeleteValue(name, false); }
            catch (Exception error) { Log.Write(error); }
        }
        public static bool StartsWithWindows
        {
            get
            {
                try { using (var key = Registry.CurrentUser.OpenSubKey(RunPath)) return key?.GetValue(RunName) != null; }
                catch { return false; }
            }
            set
            {
                try
                {
                    using (var key = Registry.CurrentUser.CreateSubKey(RunPath))
                    {
                        if (key == null) return;
                        if (value) key.SetValue(RunName, "\"" + Application.ExecutablePath + "\"");
                        else key.DeleteValue(RunName, false);
                    }
                }
                catch (Exception error) { Log.Write(error); }
            }
        }
    }

    /// <summary>The web theme colours (light and dark), as in the Mac pet.</summary>
    internal static class Theme
    {
        public static bool Dark { get; private set; }
        public static void Refresh()
        {
            try
            {
                using (var key = Registry.CurrentUser.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize"))
                    Dark = key?.GetValue("AppsUseLightTheme") is int light && light == 0;
            }
            catch { Dark = false; }
        }
        public static Color Accent => Dark ? Color.FromArgb(0xd1, 0x8b, 0x98) : Color.FromArgb(0xa6, 0x5f, 0x6b);
        public static Color PanelStrong => Dark ? Color.FromArgb(0x6b, 0x4a, 0x4f) : Color.FromArgb(0xe9, 0xd0, 0xd2);
        public static readonly Color Gold = Color.FromArgb(0xd5, 0xb9, 0x82);
        public static Color ShadowInk => Dark ? Color.Black : Color.FromArgb(0x2b, 0x24, 0x23);
        public static int Alpha(double opacity) => Math.Max(0, Math.Min(255, (int)Math.Round(opacity * 255)));
    }

    internal static class Native
    {
        public const int WS_EX_LAYERED = 0x80000, WS_EX_TRANSPARENT = 0x20, WS_EX_TOOLWINDOW = 0x80, WS_EX_NOACTIVATE = 0x08000000, WS_EX_TOPMOST = 0x8;
        public const int GWL_EXSTYLE = -20, WM_MOUSEACTIVATE = 0x21, MA_NOACTIVATE = 3, ULW_ALPHA = 2;
        public const byte AC_SRC_OVER = 0, AC_SRC_ALPHA = 1;

        [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; public POINT(int x, int y) { X = x; Y = y; } }
        [StructLayout(LayoutKind.Sequential)] public struct SIZE { public int CX, CY; public SIZE(int cx, int cy) { CX = cx; CY = cy; } }
        [StructLayout(LayoutKind.Sequential, Pack = 1)] public struct BLENDFUNCTION { public byte BlendOp, BlendFlags, SourceConstantAlpha, AlphaFormat; }
        [StructLayout(LayoutKind.Sequential)]
        public struct BITMAPINFOHEADER
        {
            public int biSize, biWidth, biHeight;
            public short biPlanes, biBitCount;
            public int biCompression, biSizeImage, biXPelsPerMeter, biYPelsPerMeter, biClrUsed, biClrImportant;
        }

        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool UpdateLayeredWindow(IntPtr hwnd, IntPtr hdcDst, ref POINT pptDst, ref SIZE psize, IntPtr hdcSrc, ref POINT pprSrc, int crKey, ref BLENDFUNCTION pblend, int dwFlags);
        [DllImport("user32.dll")] public static extern IntPtr GetDC(IntPtr hWnd);
        [DllImport("user32.dll")] public static extern int ReleaseDC(IntPtr hWnd, IntPtr hDC);
        [DllImport("gdi32.dll")] public static extern IntPtr CreateCompatibleDC(IntPtr hDC);
        [DllImport("gdi32.dll")] public static extern bool DeleteDC(IntPtr hdc);
        [DllImport("gdi32.dll")] public static extern IntPtr SelectObject(IntPtr hDC, IntPtr hObject);
        [DllImport("gdi32.dll")] public static extern bool DeleteObject(IntPtr hObject);
        [DllImport("gdi32.dll")] public static extern IntPtr CreateDIBSection(IntPtr hdc, ref BITMAPINFOHEADER pbmi, uint usage, out IntPtr bits, IntPtr section, uint offset);
        [DllImport("user32.dll", EntryPoint = "GetWindowLongW")] private static extern int GetWindowLong(IntPtr hWnd, int index);
        [DllImport("user32.dll", EntryPoint = "SetWindowLongW")] private static extern int SetWindowLong(IntPtr hWnd, int index, int value);
        [DllImport("shell32.dll")] public static extern int SHQueryUserNotificationState(out int state);
        [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();

        // the extended style is a 32-bit value on 32- and 64-bit Windows alike
        public static int GetExStyle(IntPtr window) => GetWindowLong(window, GWL_EXSTYLE);
        public static void SetExStyle(IntPtr window, int value) => SetWindowLong(window, GWL_EXSTYLE, value);
    }

    /// <summary>Easing and springs matching the web and the Mac pet.</summary>
    internal static class Ease
    {
        private static double Curve(double p1, double p2, double t) { double u = 1 - t; return 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t; }
        private static double Slope(double p1, double p2, double t) { double u = 1 - t; return 3 * u * u * p1 + 6 * u * t * (p2 - p1) + 3 * t * t * (1 - p2); }

        /// <summary>CSS cubic-bezier(x1, y1, x2, y2) at progress x.</summary>
        public static double Bezier(double x1, double y1, double x2, double y2, double x)
        {
            if (x <= 0) return 0;
            if (x >= 1) return 1;
            double t = x;
            for (int i = 0; i < 8; i++)
            {
                double error = Curve(x1, x2, t) - x;
                if (Math.Abs(error) < 1e-5) break;
                double slope = Slope(x1, x2, t);
                if (Math.Abs(slope) < 1e-6) break;
                t -= error / slope;
            }
            if (t < 0 || t > 1 || Math.Abs(Curve(x1, x2, t) - x) > 1e-3)
            {
                double low = 0, high = 1;
                t = x;
                for (int i = 0; i < 40; i++)
                {
                    double value = Curve(x1, x2, t);
                    if (Math.Abs(value - x) < 1e-5) break;
                    if (value < x) low = t; else high = t;
                    t = (low + high) / 2;
                }
            }
            return Curve(y1, y2, t);
        }
        public static double Web(double x) => Bezier(.16, 1, .3, 1, x);       // cubic-bezier(.16,1,.3,1)
        public static double Out(double x) => Bezier(0, 0, .58, 1, x);
        public static double InOut(double x) => Bezier(.42, 0, .58, 1, x);

        /// <summary>Keyframes like CAKeyframeAnimation: key times 0..1, one easing for every segment (linear when null).</summary>
        public static double Keys(double p, double[] times, double[] values, Func<double, double> ease = null)
        {
            if (p <= times[0]) return values[0];
            for (int i = 1; i < times.Length; i++)
            {
                if (p > times[i]) continue;
                double span = times[i] - times[i - 1];
                double local = span <= 0 ? 1 : (p - times[i - 1]) / span;
                double eased = ease == null ? local : ease(local);
                return values[i - 1] + (values[i] - values[i - 1]) * eased;
            }
            return values[values.Length - 1];
        }

        /// <summary>A damped spring let go at 1, at rest: how much of the starting offset is left after t seconds.</summary>
        public static double Spring(double mass, double stiffness, double damping, double t)
        {
            double w0 = Math.Sqrt(stiffness / mass);
            double zeta = damping / (2 * Math.Sqrt(stiffness * mass));
            if (zeta < 1)
            {
                double wd = w0 * Math.Sqrt(1 - zeta * zeta);
                return Math.Exp(-zeta * w0 * t) * (Math.Cos(wd * t) + zeta * w0 / wd * Math.Sin(wd * t));
            }
            return Math.Exp(-w0 * t) * (1 + w0 * t);
        }
        public static double SpringDuration(double mass, double stiffness, double damping)
        {
            double w0 = Math.Sqrt(stiffness / mass);
            double zeta = Math.Min(1, damping / (2 * Math.Sqrt(stiffness * mass)));
            return Math.Log(1000) / (zeta * w0);
        }
    }

    internal sealed class SpringAnim
    {
        private readonly double mass, stiffness, damping, start, duration;
        public SpringAnim(double now, double mass, double stiffness, double damping)
        {
            this.mass = mass; this.stiffness = stiffness; this.damping = damping; start = now;
            duration = Ease.SpringDuration(mass, stiffness, damping);
        }
        public bool Done(double now) => now - start >= duration;
        public double Left(double now) => Done(now) ? 0 : Ease.Spring(mass, stiffness, damping, now - start);
    }

    /// <summary>How the dough is pulled: a move (pixels, y down), a tilt (degrees, clockwise) and a stretch.</summary>
    internal struct Stretch
    {
        public double Tx, Ty, Angle, Sx, Sy;
        public static Stretch None => new Stretch { Sx = 1, Sy = 1 };
        public Stretch Scaled(double left) => new Stretch { Tx = Tx * left, Ty = Ty * left, Angle = Angle * left, Sx = 1 + (Sx - 1) * left, Sy = 1 + (Sy - 1) * left };
    }

    // ---------------------------------------------------------------------------------------------------------------
    // short-lived effects drawn around the dough

    internal abstract class Effect
    {
        protected readonly double Start;
        protected Effect(double start) { Start = start; }
        public abstract double Duration { get; }
        public bool Done(double now) => now - Start >= Duration;
        public abstract void Draw(Graphics g, double now);
    }

    /// <summary>web: .dough-ripple, a 2px accent ring, opacity .52 → 0, scale .2 → 1.35 over .82 s</summary>
    internal sealed class Ripple : Effect
    {
        private readonly PointF centre; private readonly float size, stroke;
        public Ripple(double start, PointF centre, float size, float stroke) : base(start) { this.centre = centre; this.size = size; this.stroke = stroke; }
        public override double Duration => 0.82;
        public override void Draw(Graphics g, double now)
        {
            double p = Ease.Web((now - Start) / Duration);
            double scale = 0.2 + 1.15 * p;
            float d = (float)(size * scale), r = d / 2;
            using (var pen = new Pen(Color.FromArgb(Theme.Alpha(0.52 * (1 - p)), Theme.Accent), (float)Math.Max(0.5, stroke * scale)))
                g.DrawEllipse(pen, centre.X - r, centre.Y - r, d, d);
        }
    }

    /// <summary>web: .pet-celebration, pills that fly out, turn and fade over .9 s</summary>
    internal sealed class Confetti : Effect
    {
        private readonly PointF centre; private readonly float dx, dy, turn, width, height; private readonly Color colour;
        public Confetti(double start, PointF centre, float dx, float dy, float turn, Color colour, float width, float height) : base(start)
        {
            this.centre = centre; this.dx = dx; this.dy = dy; this.turn = turn; this.colour = colour; this.width = width; this.height = height;
        }
        public override double Duration => 0.9;
        public override void Draw(Graphics g, double now)
        {
            double p = Ease.Web((now - Start) / Duration);
            var state = g.Save();
            g.TranslateTransform((float)(centre.X + dx * p), (float)(centre.Y + dy * p));
            g.RotateTransform((float)(turn * p));
            using (var path = Pill(width, height))
            using (var brush = new SolidBrush(Color.FromArgb(Theme.Alpha(1 - p), colour)))
                g.FillPath(brush, path);
            g.Restore(state);
        }
        private static GraphicsPath Pill(float w, float h)
        {
            var path = new GraphicsPath();
            float d = Math.Max(0.5f, Math.Min(w, h));
            path.AddArc(0, 0, d, d, 180, 90);
            path.AddArc(w - d, 0, d, d, 270, 90);
            path.AddArc(w - d, h - d, d, d, 0, 90);
            path.AddArc(0, h - d, d, d, 90, 90);
            path.CloseFigure();
            return path;
        }
    }

    /// <summary>A "z" drifting up while the dough naps.</summary>
    internal sealed class Snooze : Effect
    {
        private readonly PointF start; private readonly float size, driftX, driftUp;
        public Snooze(double begin, PointF start, float size, float driftX, float driftUp) : base(begin) { this.start = start; this.size = size; this.driftX = driftX; this.driftUp = driftUp; }
        public override double Duration => 2.4;
        public override void Draw(Graphics g, double now)
        {
            double p = (now - Start) / Duration;
            double opacity = Ease.Keys(p, new[] { 0, .2, .7, 1 }, new[] { 0.0, 1, 1, 0 }) * 0.85;
            float x = (float)(start.X + driftX * p), y = (float)(start.Y - driftUp * p);
            using (var font = new Font("Segoe UI Semibold", Math.Max(6f, size), GraphicsUnit.Pixel))
            using (var brush = new SolidBrush(Color.FromArgb(Theme.Alpha(opacity), Theme.Accent)))
            using (var format = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center })
                g.DrawString("z", font, brush, x, y, format);
        }
    }

    // ---------------------------------------------------------------------------------------------------------------
    // the dough window

    internal sealed class PetWindow : Form
    {
        private static readonly double[] SquishTimes = { 0, .33, .66, 1 };
        private static readonly double[] PuffTimes = { 0, .3, .55, .78, 1 };
        private static readonly double[] PuffValues = { 1, 1.14, .97, 1.04, 1 };
        private static readonly double[] SpeckTimes = { 0, .72, .82, .94, 1 };
        private static readonly double[] SpeckDelays = { 0, 1.55, 3.1 };
        // confetti directions from .pet-celebration i:nth-child(n): x, y (CSS pixels, y down), turn in degrees
        private static readonly double[][] ConfettiSpots =
        {
            new double[] { -62, -68, -24 }, new double[] { -28, -86, 18 }, new double[] { 10, -82, 42 }, new double[] { 48, -64, 72 },
            new double[] { 70, -28, 94 }, new double[] { 62, 22, 116 }, new double[] { 28, 54, 148 }, new double[] { -14, 58, 184 },
            new double[] { -52, 38, 214 }, new double[] { -72, 4, 244 }, new double[] { -76, -34, 282 }, new double[] { 78, 8, 312 },
            new double[] { 34, -52, 338 }, new double[] { -36, -50, 8 },
        };
        private const double BreakFreeDistance = 92;

        private readonly Bitmap source;
        private readonly Random random = new Random();
        private readonly Stopwatch clock = Stopwatch.StartNew();
        private double Now => clock.Elapsed.TotalSeconds;
        private readonly double dpi;                     // pixels per point

        // sizes in pixels for the current width
        private double widthPoints = 190;
        private int doughW, doughH, pad, winW, winH, shadowMargin;
        private Bitmap dough, shadow;
        private PointF[] speckCentres = new PointF[3];
        private float[] speckSizes = new float[3];
        private double U => widthPoints / 190.0;         // effects were drawn for a 190 pt dough; they scale with it
        public double Px(double points) => points * dpi;

        // the layered surface
        private IntPtr memDc, dib, oldBitmap, bits;
        private Bitmap canvas;
        private Graphics gfx;

        // motion state
        private enum Mode { Idle, Pending, Pull, Carry }
        private Mode mode = Mode.Idle;
        private Point downScreen, windowAtDown;
        private Stretch stretch = Stretch.None, springFrom = Stretch.None;
        private SpringAnim stretchSpring, drop, pinchSpring;
        private double pressStart = -1, liftStart = -1, puffStart = -1, squishStart = -1, squishStrength = 1;
        private double breathStart, specksStart, lastTouched;
        private bool napping, wheelActive, clickThrough;
        private double pinch = 1, pinchFrom = 1;
        private readonly List<double> taps = new List<double>();
        private readonly List<Effect> effects = new List<Effect>();
        private Point moveFrom, moveTo;
        private double moveStart = -1;
        private double fadeStart = -1, fadeFrom = 255, fadeTo = 255, fadeDuration = 0.5;
        private byte alpha = 255;

        private readonly System.Windows.Forms.Timer frameTimer = new System.Windows.Forms.Timer { Interval = 16 };
        private readonly System.Windows.Forms.Timer holdTimer = new System.Windows.Forms.Timer { Interval = 400 };
        private readonly System.Windows.Forms.Timer wheelTimer = new System.Windows.Forms.Timer { Interval = 200 };
        private readonly System.Windows.Forms.Timer openTimer = new System.Windows.Forms.Timer { Interval = Math.Max(200, SystemInformation.DoubleClickTime) };
        private readonly System.Windows.Forms.Timer napTimer = new System.Windows.Forms.Timer { Interval = 1000 };

        public Point WindowPos { get; set; }      // handed to UpdateLayeredWindow every frame
        public event Action CarryEnded;
        public event Action<Point> MenuRequested;

        public PetWindow(Bitmap source)
        {
            this.source = source;
            using (var screen = Graphics.FromHwnd(IntPtr.Zero)) dpi = Math.Max(1, screen.DpiX / 96.0);
            FormBorderStyle = FormBorderStyle.None;
            ShowInTaskbar = false;
            StartPosition = FormStartPosition.Manual;
            TopMost = true;
            Text = "AlreaDough Pet";
            frameTimer.Tick += (s, e) => OnFrame();
            holdTimer.Tick += (s, e) => PickUp();
            wheelTimer.Tick += (s, e) => ReleasePinch();
            openTimer.Tick += (s, e) => { openTimer.Stop(); taps.Clear(); Program.OpenSite(); };
            napTimer.Tick += (s, e) => NapTick();
        }

        protected override CreateParams CreateParams
        {
            get
            {
                var cp = base.CreateParams;
                cp.ExStyle |= Native.WS_EX_LAYERED | Native.WS_EX_TOOLWINDOW | Native.WS_EX_NOACTIVATE | Native.WS_EX_TOPMOST;
                return cp;
            }
        }
        protected override bool ShowWithoutActivation => true;
        protected override void OnPaintBackground(PaintEventArgs e) { /* drawn by UpdateLayeredWindow */ }
        protected override void OnPaint(PaintEventArgs e) { /* drawn by UpdateLayeredWindow */ }
        protected override void WndProc(ref Message m)
        {
            // clicking the dough never steals focus from the app you are working in
            if (m.Msg == Native.WM_MOUSEACTIVATE) { m.Result = (IntPtr)Native.MA_NOACTIVATE; return; }
            base.WndProc(ref m);
        }

        public double WidthPoints => widthPoints;
        public int Pad => pad;
        public Size DoughSize => new Size(doughW, doughH);
        public Size WindowSize => new Size(winW, winH);
        public Rectangle DoughScreenRect => new Rectangle(WindowPos.X + pad, WindowPos.Y + pad, doughW, doughH);
        private bool Busy => mode != Mode.Idle;

        public void Begin()
        {
            double now = Now;
            breathStart = specksStart = lastTouched = now;
            frameTimer.Start();
            napTimer.Start();
        }

        // ----- size and drawing surface

        public void SetWidth(double points)
        {
            widthPoints = points;
            doughW = (int)Math.Round(Px(points));
            doughH = (int)Math.Round(doughW * (double)source.Height / source.Width);
            pad = (int)Math.Round(Px(Math.Max(90, points * 0.64)));   // room for stretching, ripples and confetti
            winW = doughW + pad * 2;
            winH = doughH + pad * 2;
            dough?.Dispose();
            int artW = Math.Min(source.Width, (int)Math.Round(doughW * 1.5));
            dough = Scaled(source, artW, (int)Math.Round(artW * (double)source.Height / source.Width));
            RebuildShadow();
            PlaceSpecks();
            effects.Clear();
            CreateSurface();
            Size = new Size(winW, winH);
        }

        public void RefreshTheme()
        {
            RebuildShadow();
        }

        private void RebuildShadow()
        {
            shadow?.Dispose();
            int blur = Math.Max(1, (int)Math.Round(Px(4)));
            shadow = MakeShadow(source, doughW, doughH, blur, out shadowMargin);
        }

        // web: .proof-specks, three small rings that float up and fade (same spots as the Mac pet, flipped to y-down)
        private void PlaceSpecks()
        {
            double left = pad + doughW * .08, right = pad + doughW - doughW * .08;
            double bottomUp = pad + doughH * .08, topUp = pad + doughH - doughH * .12;
            double w = right - left, h = topUp - bottomUp;
            var up = new[]
            {
                new PointF((float)(left + w * .18 + Px(4)), (float)(bottomUp + h * .24 + Px(4))),
                new PointF((float)(right - w * .19 - Px(3)), (float)(topUp - h * .28 - Px(3))),
                new PointF((float)(right - w * .28 - Px(2.5)), (float)(bottomUp + h * .18 + Px(2.5))),
            };
            for (int i = 0; i < 3; i++) speckCentres[i] = new PointF(up[i].X, winH - up[i].Y);
            speckSizes = new[] { (float)Px(8), (float)Px(6), (float)Px(5) };
        }

        private void CreateSurface()
        {
            FreeSurface();
            memDc = Native.CreateCompatibleDC(IntPtr.Zero);
            var header = new Native.BITMAPINFOHEADER
            {
                biSize = Marshal.SizeOf(typeof(Native.BITMAPINFOHEADER)),
                biWidth = winW,
                biHeight = -winH,            // top-down, like the GDI+ bitmap that shares its memory
                biPlanes = 1,
                biBitCount = 32,
            };
            dib = Native.CreateDIBSection(IntPtr.Zero, ref header, 0, out bits, IntPtr.Zero, 0);
            if (dib == IntPtr.Zero) throw new InvalidOperationException("CreateDIBSection failed");
            oldBitmap = Native.SelectObject(memDc, dib);
            canvas = new Bitmap(winW, winH, winW * 4, PixelFormat.Format32bppPArgb, bits);
            gfx = Graphics.FromImage(canvas);
            gfx.SmoothingMode = SmoothingMode.AntiAlias;
            gfx.InterpolationMode = InterpolationMode.HighQualityBilinear;
            gfx.PixelOffsetMode = PixelOffsetMode.HighQuality;
            gfx.CompositingQuality = CompositingQuality.HighQuality;
            gfx.TextRenderingHint = TextRenderingHint.AntiAlias;
        }

        private void FreeSurface()
        {
            gfx?.Dispose(); gfx = null;
            canvas?.Dispose(); canvas = null;
            if (memDc != IntPtr.Zero) { Native.SelectObject(memDc, oldBitmap); Native.DeleteDC(memDc); memDc = IntPtr.Zero; }
            if (dib != IntPtr.Zero) { Native.DeleteObject(dib); dib = IntPtr.Zero; }
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                frameTimer.Dispose(); holdTimer.Dispose(); wheelTimer.Dispose(); openTimer.Dispose(); napTimer.Dispose();
                dough?.Dispose(); shadow?.Dispose();
            }
            FreeSurface();
            base.Dispose(disposing);
        }

        private static Bitmap Scaled(Bitmap image, int w, int h)
        {
            var result = new Bitmap(Math.Max(1, w), Math.Max(1, h), PixelFormat.Format32bppPArgb);
            using (var g = Graphics.FromImage(result))
            using (var attributes = new ImageAttributes())
            {
                g.CompositingMode = CompositingMode.SourceCopy;
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                attributes.SetWrapMode(WrapMode.TileFlipXY);
                g.DrawImage(image, new Rectangle(0, 0, result.Width, result.Height), 0, 0, image.Width, image.Height, GraphicsUnit.Pixel, attributes);
            }
            return result;
        }

        // web: drop-shadow(0 16px 16px ink 18%): the dough's outline, blurred, in ink at 18%
        private static Bitmap MakeShadow(Bitmap art, int w, int h, int blur, out int margin)
        {
            margin = blur * 3 + 2;
            int sw = w + margin * 2, sh = h + margin * 2;
            var mask = new Bitmap(sw, sh, PixelFormat.Format32bppArgb);
            using (var g = Graphics.FromImage(mask))
            {
                g.InterpolationMode = InterpolationMode.HighQualityBilinear;
                g.DrawImage(art, new Rectangle(margin, margin, w, h));
            }
            var data = mask.LockBits(new Rectangle(0, 0, sw, sh), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
            try
            {
                int stride = data.Stride;
                var buffer = new byte[stride * sh];
                Marshal.Copy(data.Scan0, buffer, 0, buffer.Length);
                var a = new float[sw * sh];
                var tmp = new float[sw * sh];
                for (int y = 0; y < sh; y++) for (int x = 0; x < sw; x++) a[y * sw + x] = buffer[y * stride + x * 4 + 3];
                for (int pass = 0; pass < 3; pass++) { BoxRows(a, tmp, sw, sh, blur); BoxColumns(tmp, a, sw, sh, blur); }
                var ink = Theme.ShadowInk;
                for (int y = 0; y < sh; y++)
                {
                    for (int x = 0; x < sw; x++)
                    {
                        int o = y * stride + x * 4;
                        buffer[o] = ink.B; buffer[o + 1] = ink.G; buffer[o + 2] = ink.R;
                        buffer[o + 3] = (byte)Math.Max(0, Math.Min(255, a[y * sw + x] * 0.18f));
                    }
                }
                Marshal.Copy(buffer, 0, data.Scan0, buffer.Length);
            }
            finally { mask.UnlockBits(data); }
            return mask;
        }
        private static int Clamp(int value, int low, int high) => value < low ? low : value > high ? high : value;
        private static void BoxRows(float[] src, float[] dst, int w, int h, int r)
        {
            float inv = 1f / (2 * r + 1);
            for (int y = 0; y < h; y++)
            {
                int row = y * w;
                float sum = 0;
                for (int x = -r; x <= r; x++) sum += src[row + Clamp(x, 0, w - 1)];
                for (int x = 0; x < w; x++)
                {
                    dst[row + x] = sum * inv;
                    sum += src[row + Clamp(x + r + 1, 0, w - 1)] - src[row + Clamp(x - r, 0, w - 1)];
                }
            }
        }
        private static void BoxColumns(float[] src, float[] dst, int w, int h, int r)
        {
            float inv = 1f / (2 * r + 1);
            for (int x = 0; x < w; x++)
            {
                float sum = 0;
                for (int y = -r; y <= r; y++) sum += src[Clamp(y, 0, h - 1) * w + x];
                for (int y = 0; y < h; y++)
                {
                    dst[y * w + x] = sum * inv;
                    sum += src[Clamp(y + r + 1, 0, h - 1) * w + x] - src[Clamp(y - r, 0, h - 1) * w + x];
                }
            }
        }

        // ----- frame loop

        private void OnFrame()
        {
            try
            {
                double now = Now;
                if (moveStart >= 0)
                {
                    double p = Math.Min(1, (now - moveStart) / 0.28);
                    double k = Ease.Out(p);
                    WindowPos = new Point((int)Math.Round(moveFrom.X + (moveTo.X - moveFrom.X) * k), (int)Math.Round(moveFrom.Y + (moveTo.Y - moveFrom.Y) * k));
                    if (p >= 1) moveStart = -1;
                }
                if (fadeStart >= 0)
                {
                    double p = Math.Min(1, (now - fadeStart) / fadeDuration);
                    alpha = (byte)Math.Round(fadeFrom + (fadeTo - fadeFrom) * p);
                    if (p >= 1)
                    {
                        fadeStart = -1;
                        if (fadeTo <= 0) { Hide(); frameTimer.Stop(); return; }
                    }
                }
                if (!Visible) { frameTimer.Stop(); return; }
                Render(now);
                // smooth while something moves, lighter on the processor while it only breathes
                int interval = Busy || effects.Count > 0 || squishStart >= 0 || stretchSpring != null || pinchSpring != null || drop != null
                    || puffStart >= 0 || moveStart >= 0 || fadeStart >= 0 || pressStart >= 0 || liftStart >= 0 || wheelActive ? 16 : 40;
                if (frameTimer.Interval != interval) frameTimer.Interval = interval;
            }
            catch (Exception error)
            {
                Log.Write(error);
            }
        }

        private void Render(double now)
        {
            if (gfx == null || !IsHandleCreated) return;
            gfx.ResetTransform();
            gfx.Clear(Color.Transparent);
            DrawSpecks(now);
            using (var matrix = CharacterMatrix(now))
            {
                using (var lowered = matrix.Clone())
                {
                    lowered.Translate(0, (float)Px(16), MatrixOrder.Append);
                    gfx.Transform = lowered;
                    gfx.DrawImage(shadow, new RectangleF(-shadowMargin, -shadowMargin, doughW + shadowMargin * 2, doughH + shadowMargin * 2));
                }
                gfx.Transform = matrix;
                gfx.DrawImage(dough, new RectangleF(0, 0, doughW, doughH));
            }
            gfx.ResetTransform();
            effects.RemoveAll(effect => effect.Done(now));
            foreach (var effect in effects) effect.Draw(gfx, now);
            Push();
        }

        private void Push()
        {
            gfx.Flush(FlushIntention.Sync);
            IntPtr screen = Native.GetDC(IntPtr.Zero);
            try
            {
                var position = new Native.POINT(WindowPos.X, WindowPos.Y);
                var size = new Native.SIZE(winW, winH);
                var origin = new Native.POINT(0, 0);
                var blend = new Native.BLENDFUNCTION { BlendOp = Native.AC_SRC_OVER, BlendFlags = 0, SourceConstantAlpha = alpha, AlphaFormat = Native.AC_SRC_ALPHA };
                Native.UpdateLayeredWindow(Handle, screen, ref position, ref size, memDc, ref origin, 0, ref blend, Native.ULW_ALPHA);
            }
            finally { Native.ReleaseDC(IntPtr.Zero, screen); }
        }

        /// <summary>Breathing and squish, then pull / carry / press, then the wheel pinch, all in window pixels.</summary>
        private Matrix CharacterMatrix(double now)
        {
            var m = new Matrix();
            float left = pad, top = pad;
            m.Translate(left, top, MatrixOrder.Append);

            // breathing (web: scaleX 1→1.035, scaleY 1→1.055, up 4 px over 5.4 s), around 50% 88%
            double amount = napping ? 0.5 : 1, period = napping ? 8.4 : 5.4;
            double phase = ((now - breathStart) % period) / period;
            double k = phase < 0.42 ? Ease.Out(phase / 0.42) : 1 - Ease.InOut((phase - 0.42) / 0.58);
            double sx = 1 + 0.035 * amount * k, sy = 1 + 0.055 * amount * k, lift = 4 * amount * U * k;
            if (squishStart >= 0)
            {
                double p = (now - squishStart) / 0.7;
                if (p >= 1) squishStart = -1;
                else
                {
                    double s = squishStrength;
                    sx += Ease.Keys(p, SquishTimes, new[] { 0, 0.05 * s, -0.02 * s, 0 }, Ease.Web);
                    sy += Ease.Keys(p, SquishTimes, new[] { 0, -0.09 * s, 0.035 * s, 0 }, Ease.Web);
                    lift += Ease.Keys(p, SquishTimes, new[] { 0, -5 * s * U, 2 * s * U, 0 }, Ease.Web);
                }
            }
            float cx = left + doughW / 2f, cy = top + doughH * 0.88f;
            m.Translate(-cx, -cy, MatrixOrder.Append);
            m.Scale((float)sx, (float)sy, MatrixOrder.Append);
            m.Translate(cx, cy - (float)Px(lift), MatrixOrder.Append);

            // pull, carry and press, around 50% 58% (web: .dough-drag-shell)
            var st = CurrentStretch(now);
            double uniform = UniformScale(now);
            float dx = left + doughW / 2f, dy = top + doughH * 0.58f;
            m.Translate(-dx, -dy, MatrixOrder.Append);
            m.Scale((float)(st.Sx * uniform), (float)(st.Sy * uniform), MatrixOrder.Append);
            m.Rotate((float)st.Angle, MatrixOrder.Append);
            m.Translate(dx + (float)st.Tx, dy + (float)st.Ty, MatrixOrder.Append);

            // the wheel grows it from its bottom edge, so it stays on the floor
            double size = CurrentPinch(now);
            float px = left + doughW / 2f, py = top + doughH;
            m.Translate(-px, -py, MatrixOrder.Append);
            m.Scale((float)size, (float)size, MatrixOrder.Append);
            m.Translate(px, py, MatrixOrder.Append);
            return m;
        }

        private Stretch CurrentStretch(double now)
        {
            if (mode == Mode.Pull) return stretch;
            if (stretchSpring == null) return Stretch.None;
            if (stretchSpring.Done(now)) { stretchSpring = null; return Stretch.None; }
            return springFrom.Scaled(stretchSpring.Left(now));
        }

        private double UniformScale(double now)
        {
            double s = 1;
            if (pressStart >= 0) s *= 1 - 0.03 * Math.Min(1, (now - pressStart) / 0.12);        // web: whileTap .97
            if (liftStart >= 0) s *= 1 + 0.06 * Math.Min(1, (now - liftStart) / 0.18);          // picked up
            if (drop != null) { if (drop.Done(now)) drop = null; else s *= 1 + 0.06 * drop.Left(now); }
            if (puffStart >= 0)
            {
                double p = (now - puffStart) / 0.9;
                if (p >= 1) puffStart = -1; else s *= Ease.Keys(p, PuffTimes, PuffValues, Ease.Web);
            }
            return s;
        }

        private double CurrentPinch(double now)
        {
            if (pinchSpring == null) return pinch;
            if (pinchSpring.Done(now)) { pinchSpring = null; pinch = 1; return 1; }
            return 1 + (pinchFrom - 1) * pinchSpring.Left(now);
        }

        private void DrawSpecks(double now)
        {
            double t = now - specksStart;
            for (int i = 0; i < 3; i++)
            {
                double local = t - SpeckDelays[i];
                if (local < 0) continue;
                double p = (local % 4.8) / 4.8;
                double opacity = Ease.Keys(p, SpeckTimes, new[] { 0, 0, 0.72, 0, 0 });
                if (opacity < 0.01) continue;
                double rise = Ease.Keys(p, SpeckTimes, new[] { -5 * U, -5 * U, 0, 18 * U, -5 * U });
                double scale = Ease.Keys(p, SpeckTimes, new[] { 0.7, 0.7, 0.9, 1.08, 0.7 });
                float d = (float)(speckSizes[i] * scale);
                float x = speckCentres[i].X, y = speckCentres[i].Y - (float)Px(rise);
                using (var pen = new Pen(Color.FromArgb(Theme.Alpha(opacity * 0.58), Theme.Accent), (float)Px(1)))
                    gfx.DrawEllipse(pen, x - d / 2, y - d / 2, d, d);
            }
        }

        // ----- reactions

        private void Squish(double strength = 1) { squishStart = Now; squishStrength = strength; }

        private void AddRipple()
        {
            double size = doughW * 0.64;
            var centre = new PointF(pad + doughW / 2f, (float)(winH - (pad + doughH * 0.12 + size / 2)));
            effects.Add(new Ripple(Now, centre, (float)size, (float)Px(2)));
        }

        private void AddConfetti(int extra = 0)
        {
            var centre = new PointF(pad + doughW / 2f, pad + doughH / 2f);
            var spots = new List<double[]>(ConfettiSpots);
            for (int i = 0; i < extra; i++)   // a bigger burst for the party
            {
                double angle = (double)i / Math.Max(1, extra) * 2 * Math.PI;
                double reach = 70 + random.NextDouble() * 35;
                spots.Add(new[] { Math.Cos(angle) * reach, Math.Sin(angle) * reach, random.NextDouble() * 360 });
            }
            double now = Now;
            for (int i = 0; i < spots.Count; i++)
            {
                int n = i + 1;
                var colour = n % 3 == 0 ? Theme.PanelStrong : n % 3 == 1 ? Theme.Gold : Theme.Accent;
                effects.Add(new Confetti(now, centre, (float)Px(spots[i][0] * U), (float)Px(spots[i][1] * U), (float)spots[i][2], colour, (float)Px(7 * U), (float)Px(12 * U)));
            }
        }

        private void Respond() { Squish(); AddRipple(); AddConfetti(); }
        private void Party() { Squish(1.7); AddRipple(); AddConfetti(18); puffStart = Now; }

        public void WelcomeBack() { lastTouched = Now; Squish(1.1); AddRipple(); }

        // ----- nap

        private void NapTick()
        {
            if (mode != Mode.Idle || !Visible) return;
            if (napping)
            {
                var start = new PointF((float)(pad + doughW * 0.72), (float)(winH - (pad + doughH * 0.78)));
                effects.Add(new Snooze(Now, start, (float)Px((13 + random.NextDouble() * 5) * U), (float)Px(14 * U), (float)Px(34 * U)));
                return;
            }
            if (Now - lastTouched > 90) { napping = true; breathStart = Now; }
        }

        private void Wake(bool playful)
        {
            lastTouched = Now;
            if (!napping) return;
            napping = false;
            breathStart = Now;
            if (playful) Squish(0.7);
        }

        // ----- the mouse

        /// <summary>Called every 50 ms: only the dough takes the mouse, the margin around it lets clicks through.</summary>
        public void WatchMouse()
        {
            if (!IsHandleCreated) return;
            if (!Visible || alpha == 0) { SetClickThrough(true); return; }
            bool inside = DoughScreenRect.Contains(Cursor.Position);
            SetClickThrough(!(inside || Busy));
            if (inside) { if (napping) Wake(true); else lastTouched = Now; }
        }

        private void SetClickThrough(bool on)
        {
            if (on == clickThrough) return;
            clickThrough = on;
            int style = Native.GetExStyle(Handle);
            Native.SetExStyle(Handle, on ? style | Native.WS_EX_TRANSPARENT : style & ~Native.WS_EX_TRANSPARENT);
        }

        protected override void OnMouseDown(MouseEventArgs e)
        {
            base.OnMouseDown(e);
            if (e.Button != MouseButtons.Left) return;
            Wake(false);
            openTimer.Stop();                 // a third quick tap is coming: a party, not the website
            downScreen = Cursor.Position;
            windowAtDown = WindowPos;
            moveStart = -1;
            mode = Mode.Pending;
            pressStart = Now;
            holdTimer.Stop();
            holdTimer.Start();
        }

        private void PickUp()
        {
            holdTimer.Stop();
            if (mode != Mode.Pending) return;
            mode = Mode.Carry;
            pressStart = -1;
            liftStart = Now;
            drop = null;
        }

        protected override void OnMouseMove(MouseEventArgs e)
        {
            base.OnMouseMove(e);
            if (mode == Mode.Idle) return;
            var now = Cursor.Position;
            int dx = now.X - downScreen.X, dy = now.Y - downScreen.Y;
            if (mode == Mode.Pending && Math.Abs(dx) + Math.Abs(dy) > Px(4))
            {
                holdTimer.Stop();
                mode = Mode.Pull;
                pressStart = -1;
                stretchSpring = null;
            }
            if (mode == Mode.Pull)
            {
                if (Math.Sqrt(dx * dx + dy * dy) > Px(BreakFreeDistance * U)) BreakFree(); else Pull(dx, dy);
            }
            else if (mode == Mode.Carry)
            {
                WindowPos = new Point(windowAtDown.X + dx, windowAtDown.Y + dy);
            }
        }

        // inside the limit it follows the mouse, beyond it only a fifth of the extra gets through
        private static double Elastic(double value, double low, double high)
        {
            if (value > high) return high + (value - high) * 0.22;
            if (value < low) return low + (value - low) * 0.22;
            return value;
        }

        private void Pull(int dxPixels, int dyPixels)
        {
            double tx = Elastic(dxPixels / dpi / U, -52, 52);
            double up = Elastic(-dyPixels / dpi / U, -22, 52);   // a downward pull has less room above the floor
            double ax = Math.Min(Math.Abs(tx), 76), ay = Math.Min(Math.Abs(up), 76);
            stretch = new Stretch
            {
                Tx = Px(tx * U),
                Ty = -Px(up * U),
                Angle = tx / 22,
                Sx = 1 + ax / 150 - ay / 430,
                Sy = 1 + ay / 150 - ax / 430,
            };
        }

        // Pulled past the limit: the dough breaks free and the whole pet follows the mouse. The window jumps to where the
        // dough looks right now and the stretch relaxes with a spring, so nothing jumps on screen.
        private void BreakFree()
        {
            mode = Mode.Carry;
            windowAtDown = new Point(windowAtDown.X + (int)Math.Round(stretch.Tx), windowAtDown.Y + (int)Math.Round(stretch.Ty));
            downScreen = Cursor.Position;
            springFrom = new Stretch { Sx = stretch.Sx, Sy = stretch.Sy, Angle = stretch.Angle };
            stretchSpring = new SpringAnim(Now, 1, 380, 15);
            stretch = Stretch.None;
            WindowPos = windowAtDown;
            liftStart = Now;
            drop = null;
        }

        protected override void OnMouseUp(MouseEventArgs e)
        {
            base.OnMouseUp(e);
            if (e.Button == MouseButtons.Right)
            {
                if (mode == Mode.Idle) MenuRequested?.Invoke(Cursor.Position);
                return;
            }
            if (e.Button != MouseButtons.Left) return;
            holdTimer.Stop();
            pressStart = -1;
            var was = mode;
            mode = Mode.Idle;
            lastTouched = Now;
            switch (was)
            {
                case Mode.Pull:
                    springFrom = stretch;
                    stretch = Stretch.None;
                    stretchSpring = new SpringAnim(Now, 1, 420, 17);
                    break;
                case Mode.Carry:
                    liftStart = -1;
                    drop = new SpringAnim(Now, 1, 360, 14);
                    CarryEnded?.Invoke();
                    break;
                case Mode.Pending:
                    Tap();
                    break;
            }
        }

        private void Tap()
        {
            double now = Now;
            taps.RemoveAll(time => now - time >= 0.9);
            taps.Add(now);
            if (taps.Count >= 3) { taps.Clear(); openTimer.Stop(); Party(); return; }
            Respond();
            // a double-click opens AlreaDough, unless a third tap follows (then it is a party)
            if (taps.Count == 2 && (taps[1] - taps[0]) * 1000 <= SystemInformation.DoubleClickTime) { openTimer.Stop(); openTimer.Start(); }
        }

        private static double Rubber(double value)
        {
            const double min = 0.55, max = 1.55;
            if (value > max) return max + (value - max) * 0.25;
            if (value < min) return min - (min - value) * 0.25;
            return value;
        }

        // the mouse wheel (or a touchpad pinch, which Windows sends as a wheel) grows and shrinks it; it springs back
        protected override void OnMouseWheel(MouseEventArgs e)
        {
            base.OnMouseWheel(e);
            if (!DoughScreenRect.Contains(Cursor.Position)) return;
            Wake(false);
            if (!wheelActive)
            {
                wheelActive = true;
                pinch = CurrentPinch(Now);
                pinchSpring = null;
            }
            pinch = Rubber(pinch * Math.Exp(e.Delta / 120.0 * 0.12));
            wheelTimer.Stop();
            wheelTimer.Start();
        }

        private void ReleasePinch()
        {
            wheelTimer.Stop();
            wheelActive = false;
            if (Math.Abs(pinch - 1) < 0.001) { pinch = 1; return; }
            pinchFrom = pinch;
            pinch = 1;
            pinchSpring = new SpringAnim(Now, 0.9, 230, 11);
        }

        // ----- moving, showing, hiding

        public void MoveTo(Point target, bool animate)
        {
            if (!animate) { WindowPos = target; moveStart = -1; return; }
            moveFrom = WindowPos;
            moveTo = target;
            moveStart = Now;
            if (Visible) frameTimer.Start();
        }

        public void FadeTo(bool shown)
        {
            fadeFrom = alpha;
            fadeTo = shown ? 255 : 0;
            fadeDuration = shown ? 0.5 : 0.45;
            fadeStart = Now;
            if (shown && !Visible)
            {
                alpha = 0;
                fadeFrom = 0;
                Render(Now);
                Show();
            }
            frameTimer.Start();
        }
    }

    // ---------------------------------------------------------------------------------------------------------------
    // the app: the dough, the tray icon, hiding, sizes, positions

    internal sealed class PetContext : ApplicationContext
    {
        private static readonly (string zh, string en, double width)[] Sizes =
        {
            ("特小", "Extra small", 130), ("小", "Small", 160), ("中", "Medium", 190), ("大", "Large", 270), ("特大", "Extra large", 520),
        };
        private static readonly (string zh, string en, double seconds)[] HideChoices =
        {
            ("30 分钟", "30 minutes", 1800), ("1 小时", "1 hour", 3600), ("2 小时", "2 hours", 7200),
            ("到明天早上", "Until tomorrow morning", -1), ("直到我叫它回来", "Until I call it back", 0),
        };
        private static readonly DateTime Forever = new DateTime(2100, 1, 1);

        private readonly PetWindow pet;
        private readonly NotifyIcon tray;
        private readonly Icon trayIcon, trayIconDim;
        private readonly ContextMenuStrip petMenu = new ContextMenuStrip();
        private readonly ContextMenuStrip trayMenu = new ContextMenuStrip();
        private readonly System.Windows.Forms.Timer watcher = new System.Windows.Forms.Timer { Interval = 50 };
        private readonly System.Windows.Forms.Timer visibility = new System.Windows.Forms.Timer { Interval = 1000 };
        private DateTime? hideUntil;
        private bool fullScreenNow, visibleNow = true;
        private DateTime lastFullScreenCheck = DateTime.MinValue;

        private static bool AutoHideFullScreen
        {
            get => Settings.Get("AutoHideFullScreen", 1) != 0;
            set => Settings.Set("AutoHideFullScreen", value ? 1 : 0);
        }

        public PetContext(EventWaitHandle comeBack)
        {
            Theme.Refresh();
            var art = LoadResource("dough.png");
            pet = new PetWindow(art);
            double width = Settings.Get("Width", 190);
            if (width < 100 || width > 600) width = 190;
            pet.SetWidth(width);
            pet.WindowPos = StartOrigin();
            pet.Location = pet.WindowPos;
            pet.CarryEnded += KeepReachable;
            pet.MenuRequested += point => { Fill(petMenu, false); petMenu.Show(point); };

            using (var mark = LoadResource("mark.png"))
            {
                trayIcon = MakeIcon(mark, 1f);
                trayIconDim = MakeIcon(mark, 0.45f);
            }
            // WinForms cancels opening a menu that has no items yet; it is filled here, so let it open
            trayMenu.Opening += (s, e) => { Fill(trayMenu, true); e.Cancel = false; };
            tray = new NotifyIcon { Icon = trayIcon, Text = T.S("AlreaDough 桌宠", "AlreaDough Pet"), ContextMenuStrip = trayMenu, Visible = true };
            // left-click brings the dough back (or waves hello); right-click opens the menu
            tray.MouseClick += (s, e) => { if (e.Button == MouseButtons.Left) ComeBack(); };

            // a hide chosen earlier survives a restart, so quitting and reopening does not undo it (and it still ends on time)
            double savedHide = Settings.Get("HideUntil", 0);
            if (savedHide > 0) { var until = FromUnix(savedHide); if (until > DateTime.Now) hideUntil = until; }

            // start hidden when a hide is still running or a full-screen app has the screen, without a flash
            fullScreenNow = AutoHideFullScreen && IsFullScreenAppActive();
            lastFullScreenCheck = DateTime.Now;
            visibleNow = !hideUntil.HasValue && !fullScreenNow;
            pet.CreateControl();
            var created = pet.Handle;   // the window must exist for the "come back" signal even while hidden
            pet.Begin();
            if (visibleNow) pet.Show();
            watcher.Tick += (s, e) => pet.WatchMouse();
            watcher.Start();
            visibility.Tick += (s, e) => TickVisibility(false);
            visibility.Start();
            TickVisibility(true);

            SystemEvents.UserPreferenceChanged += OnPreferenceChanged;
            SystemEvents.DisplaySettingsChanged += OnDisplayChanged;
            ThreadPool.RegisterWaitForSingleObject(comeBack, (state, timedOut) =>
            {
                try { if (pet.IsHandleCreated && !pet.IsDisposed) pet.BeginInvoke(new Action(ComeBack)); } catch { /* closing */ }
            }, null, -1, false);

            if (Settings.Get("Welcomed", 0) == 0)
            {
                Settings.Set("Welcomed", 1);
                tray.ShowBalloonTip(6000, "AlreaDough", T.S(
                    "面团住在屏幕右下角了。右键面团，或者右键这里的小图标，可以换大小、躲一会儿或者退出。",
                    "The dough lives in the bottom-right corner. Right-click it, or this little icon, to resize it, hide it for a while, or quit."), ToolTipIcon.None);
            }
        }

        private static Bitmap LoadResource(string name)
        {
            using (var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream(name))
            {
                if (stream == null) throw new FileNotFoundException("missing resource", name);
                using (var image = Image.FromStream(stream)) return new Bitmap(image);
            }
        }

        private static Icon MakeIcon(Bitmap mark, float opacity)
        {
            int size = Math.Max(16, SystemInformation.SmallIconSize.Width);
            using (var bitmap = new Bitmap(size, size, PixelFormat.Format32bppArgb))
            {
                using (var g = Graphics.FromImage(bitmap))
                using (var attributes = new ImageAttributes())
                {
                    g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                    g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                    attributes.SetColorMatrix(new ColorMatrix { Matrix33 = opacity });
                    g.DrawImage(mark, new Rectangle(0, 0, size, size), 0, 0, mark.Width, mark.Height, GraphicsUnit.Pixel, attributes);
                }
                // two icons for the life of the app, so the handle is simply kept
                return Icon.FromHandle(bitmap.GetHicon());
            }
        }

            private void OnPreferenceChanged(object sender, UserPreferenceChangedEventArgs e)
        {
            bool wasDark = Theme.Dark;
            Theme.Refresh();
            if (wasDark != Theme.Dark) pet.RefreshTheme();
        }

        private void OnDisplayChanged(object sender, EventArgs e) => KeepReachable();

        // ----- the menus (the same items on the dough and on the tray icon)

        private void Fill(ContextMenuStrip menu, bool fromTray)
        {
            var old = menu.Items.Cast<ToolStripItem>().ToList();
            menu.Items.Clear();
            foreach (var item in old) item.Dispose();

            if (fromTray)
            {
                string status;
                if (hideUntil.HasValue)
                {
                    if (hideUntil.Value >= Forever) status = T.S("面团躲起来了，等你叫它回来", "The dough is hiding until you call it back");
                    else
                    {
                        string when = hideUntil.Value.Date == DateTime.Today ? hideUntil.Value.ToString("HH:mm") : hideUntil.Value.ToString(T.S("M月d日 HH:mm", "MMM d, HH:mm"));
                        status = T.S("面团躲起来了，" + when + " 回来", "The dough is hiding until " + when);
                    }
                }
                else status = fullScreenNow ? T.S("面团在躲全屏，一会儿就回来", "The dough steps aside while an app is full screen") : T.S("面团在桌面上", "The dough is on your desktop");
                menu.Items.Add(new ToolStripMenuItem(status) { Enabled = false });
            }
            else menu.Items.Add(Item(T.S("打开 AlreaDough", "Open AlreaDough"), Program.OpenSite));

            if (hideUntil.HasValue) menu.Items.Add(Item(T.S("叫它回来", "Call it back"), ComeBack));
            else
            {
                var hide = new ToolStripMenuItem(T.S("躲一会儿", "Hide for a while"));
                foreach (var choice in HideChoices) { double seconds = choice.seconds; hide.DropDownItems.Add(Item(T.S(choice.zh, choice.en), () => HideFor(seconds))); }
                menu.Items.Add(hide);
            }
            menu.Items.Add(Item(T.S("全屏时自动躲起来", "Hide when an app is full screen"), () => { AutoHideFullScreen = !AutoHideFullScreen; TickVisibility(true); }, AutoHideFullScreen));
            menu.Items.Add(Item(T.S("开机时自动出现", "Start with Windows"), () => Settings.StartsWithWindows = !Settings.StartsWithWindows, Settings.StartsWithWindows));
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add(Item(T.S("放回屏幕右下角", "Back to the corner"), GoHome));
            var sizes = new ToolStripMenuItem(T.S("大小", "Size"));
            foreach (var size in Sizes) { double width = size.width; sizes.DropDownItems.Add(Item(T.S(size.zh, size.en), () => Resize(width), Math.Abs(width - pet.WidthPoints) < 1)); }
            menu.Items.Add(sizes);
            if (fromTray) menu.Items.Add(Item(T.S("打开 AlreaDough", "Open AlreaDough"), Program.OpenSite));
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add(Item(T.S("退出桌宠", "Quit"), Quit));
        }

        private static ToolStripMenuItem Item(string text, Action action, bool check = false)
        {
            var item = new ToolStripMenuItem(text) { Checked = check };
            item.Click += (s, e) =>
            {
                try { action(); }
                catch (Exception error) { Log.Write(error); }
            };
            return item;
        }

        // ----- hiding

        private void HideFor(double seconds)
        {
            DateTime until;
            if (seconds > 0) until = DateTime.Now.AddSeconds(seconds);
            else if (seconds < 0) { var eight = DateTime.Today.AddHours(8); until = DateTime.Now < eight ? eight : eight.AddDays(1); }
            else until = Forever;
            hideUntil = until;
            Settings.Set("HideUntil", ToUnix(until));
            TickVisibility(true);
        }

        private void ComeBack()
        {
            bool wasHiding = hideUntil.HasValue;
            hideUntil = null;
            Settings.Remove("HideUntil");
            TickVisibility(true);
            if (!wasHiding && visibleNow) { KeepReachable(); pet.WelcomeBack(); }
        }

        private void TickVisibility(bool force)
        {
            if (hideUntil.HasValue && hideUntil.Value <= DateTime.Now) { hideUntil = null; Settings.Remove("HideUntil"); }
            if (force || (DateTime.Now - lastFullScreenCheck).TotalSeconds > 1.4)
            {
                fullScreenNow = AutoHideFullScreen && IsFullScreenAppActive();
                lastFullScreenCheck = DateTime.Now;
            }
            bool show = !hideUntil.HasValue && !fullScreenNow;
            var icon = show ? trayIcon : trayIconDim;
            if (tray.Icon != icon) tray.Icon = icon;
            if (show == visibleNow) return;
            visibleNow = show;
            pet.FadeTo(show);
            if (show) pet.WelcomeBack();
        }

        // Windows says when a full-screen app (a film, a game, a slideshow) has the screen; no permission needed.
        private static bool IsFullScreenAppActive()
        {
            try
            {
                int state;
                if (Native.SHQueryUserNotificationState(out state) != 0) return false;
                return state == 2 || state == 3 || state == 4;   // busy (full screen), Direct3D full screen, presentation mode
            }
            catch { return false; }
        }

        // ----- where the dough sits

        private Point HomeOrigin()
        {
            var area = (Screen.PrimaryScreen ?? Screen.AllScreens[0]).WorkingArea;
            var dough = pet.DoughSize;
            return new Point(area.Right - (int)Math.Round(pet.Px(24)) - dough.Width - pet.Pad, area.Bottom - (int)Math.Round(pet.Px(16)) - dough.Height - pet.Pad);
        }

        private Point StartOrigin()
        {
            if (Settings.Has("X"))
            {
                var saved = new Point((int)Settings.Get("X", 0), (int)Settings.Get("Y", 0));
                var frame = new Rectangle(saved, pet.WindowSize);
                if (Screen.AllScreens.Any(screen => screen.WorkingArea.IntersectsWith(frame))) return saved;
            }
            return HomeOrigin();
        }

        private void GoHome()
        {
            var target = HomeOrigin();
            pet.MoveTo(target, true);
            SaveOrigin(target);
        }

        // Anywhere on any screen is fine, but at least half of the dough stays on a screen so it can always be grabbed again.
        private void KeepReachable()
        {
            var dough = pet.DoughScreenRect;
            var best = Screen.AllScreens.Select(screen => screen.Bounds).OrderByDescending(bounds => Overlap(bounds, dough)).FirstOrDefault();
            if (best.IsEmpty || Overlap(best, dough) == 0) best = (Screen.PrimaryScreen ?? Screen.AllScreens[0]).Bounds;
            int slackX = dough.Width / 2, slackY = dough.Height / 2, shiftX = 0, shiftY = 0;
            if (dough.Left < best.Left - slackX) shiftX = best.Left - slackX - dough.Left;
            if (dough.Right > best.Right + slackX) shiftX = best.Right + slackX - dough.Right;
            if (dough.Top < best.Top - slackY) shiftY = best.Top - slackY - dough.Top;
            if (dough.Bottom > best.Bottom + slackY) shiftY = best.Bottom + slackY - dough.Bottom;
            var target = new Point(pet.WindowPos.X + shiftX, pet.WindowPos.Y + shiftY);
            if (shiftX != 0 || shiftY != 0) pet.MoveTo(target, true);
            SaveOrigin(target);
        }

        private static long Overlap(Rectangle a, Rectangle b)
        {
            var both = Rectangle.Intersect(a, b);
            return both.IsEmpty ? 0 : (long)both.Width * both.Height;
        }

        private static void SaveOrigin(Point origin)
        {
            Settings.Set("X", origin.X);
            Settings.Set("Y", origin.Y);
        }

        // a new size keeps the dough standing where it was (same middle, same floor)
        private void Resize(double width)
        {
            var before = pet.DoughScreenRect;
            int middle = before.Left + before.Width / 2, floor = before.Bottom;
            pet.SetWidth(width);
            var origin = new Point(middle - pet.DoughSize.Width / 2 - pet.Pad, floor - pet.DoughSize.Height - pet.Pad);
            pet.MoveTo(origin, false);
            Settings.Set("Width", width);
            SaveOrigin(origin);
            KeepReachable();
        }

        private void Quit()
        {
            watcher.Stop();
            visibility.Stop();
            SystemEvents.UserPreferenceChanged -= OnPreferenceChanged;
            SystemEvents.DisplaySettingsChanged -= OnDisplayChanged;
            tray.Visible = false;     // otherwise a ghost icon stays next to the clock until the mouse passes over it
            tray.Dispose();
            pet.Close();
            ExitThread();
        }

        private static double ToUnix(DateTime local) => (local.ToUniversalTime() - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalSeconds;
        private static DateTime FromUnix(double seconds) => new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc).AddSeconds(seconds).ToLocalTime();
    }
}
