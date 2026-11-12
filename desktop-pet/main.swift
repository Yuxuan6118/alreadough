import AppKit

// AlreaDough desktop pet: just the dough, floating on the desktop. No check-in, no buttons.
//   drag        move it anywhere (it remembers the spot)
//   click       it squishes and a little heart floats up
//   double-click open AlreaDough in the browser
//   right-click size, open AlreaDough, quit

let siteURL = URL(string: "https://alreadough.com")!
let defaults = UserDefaults.standard

final class PetView: NSView {
    private let breathLayer = CALayer()   // slow breathing
    private let squishLayer = CALayer()   // the bounce when it is clicked
    private var mouseDownScreen = NSPoint.zero
    private var windowOriginAtDown = NSPoint.zero
    private var moved = false
    private let image: CGImage
    var onSizeChoice: ((CGFloat) -> Void)?
    var onMoveEnd: (() -> Void)?

    init(frame: NSRect, image: CGImage) {
        self.image = image
        super.init(frame: frame)
        wantsLayer = true
        layer = CALayer()
        layer?.backgroundColor = NSColor.clear.cgColor
        for item in [breathLayer, squishLayer] {
            item.anchorPoint = CGPoint(x: 0.5, y: 0)
        }
        squishLayer.contents = image
        squishLayer.contentsGravity = .resizeAspect
        breathLayer.addSublayer(squishLayer)
        layer?.addSublayer(breathLayer)
        layoutPet()
        startBreathing()
    }

    required init?(coder: NSCoder) { fatalError("not used") }

    override var acceptsFirstResponder: Bool { true }
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }

    override func layout() {
        super.layout()
        layoutPet()
    }

    private func layoutPet() {
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        let pad: CGFloat = 12
        let area = bounds.insetBy(dx: pad, dy: pad)
        let scale = window?.backingScaleFactor ?? NSScreen.main?.backingScaleFactor ?? 2
        for item in [breathLayer, squishLayer] {
            item.bounds = CGRect(origin: .zero, size: area.size)
            item.contentsScale = scale
        }
        breathLayer.position = CGPoint(x: bounds.midX, y: pad)
        squishLayer.position = CGPoint(x: area.width / 2, y: 0)
        CATransaction.commit()
    }

    private func startBreathing() {
        let rise = CABasicAnimation(keyPath: "transform.scale.y")
        rise.fromValue = 1.0
        rise.toValue = 1.035
        let narrow = CABasicAnimation(keyPath: "transform.scale.x")
        narrow.fromValue = 1.0
        narrow.toValue = 0.992
        for animation in [rise, narrow] {
            animation.duration = 2.6
            animation.autoreverses = true
            animation.repeatCount = .infinity
            animation.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
        }
        breathLayer.add(rise, forKey: "rise")
        breathLayer.add(narrow, forKey: "narrow")
    }

    private func bounce() {
        let squashY = CAKeyframeAnimation(keyPath: "transform.scale.y")
        squashY.values = [1.0, 0.80, 1.09, 0.97, 1.0]
        let stretchX = CAKeyframeAnimation(keyPath: "transform.scale.x")
        stretchX.values = [1.0, 1.12, 0.94, 1.02, 1.0]
        for animation in [squashY, stretchX] {
            animation.keyTimes = [0, 0.22, 0.52, 0.78, 1]
            animation.duration = 0.55
            animation.timingFunctions = Array(repeating: CAMediaTimingFunction(name: .easeInEaseOut), count: 4)
        }
        squishLayer.add(squashY, forKey: "squashY")
        squishLayer.add(stretchX, forKey: "stretchX")
        floatHeart()
    }

    private func floatHeart() {
        let heart = CATextLayer()
        heart.string = "♡"
        heart.fontSize = 24
        heart.alignmentMode = .center
        heart.foregroundColor = NSColor(calibratedRed: 0.65, green: 0.37, blue: 0.42, alpha: 1).cgColor
        heart.contentsScale = window?.backingScaleFactor ?? 2
        heart.bounds = CGRect(x: 0, y: 0, width: 30, height: 30)
        let start = CGPoint(x: bounds.midX + CGFloat.random(in: -20...20), y: bounds.height * 0.72)
        heart.position = start
        layer?.addSublayer(heart)
        let rise = CABasicAnimation(keyPath: "position.y")
        rise.fromValue = start.y
        rise.toValue = min(bounds.height - 16, start.y + 34)
        let fade = CABasicAnimation(keyPath: "opacity")
        fade.fromValue = 1.0
        fade.toValue = 0.0
        let group = CAAnimationGroup()
        group.animations = [rise, fade]
        group.duration = 0.9
        group.isRemovedOnCompletion = false
        group.fillMode = .forwards
        heart.add(group, forKey: "float")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.95) { heart.removeFromSuperlayer() }
    }

    // Dragging and clicking share the mouse, so tell them apart by how far it travelled.
    override func mouseDown(with event: NSEvent) {
        mouseDownScreen = NSEvent.mouseLocation
        windowOriginAtDown = window?.frame.origin ?? .zero
        moved = false
        if event.clickCount == 2 { NSWorkspace.shared.open(siteURL) }
    }

    override func mouseDragged(with event: NSEvent) {
        let now = NSEvent.mouseLocation
        let dx = now.x - mouseDownScreen.x
        let dy = now.y - mouseDownScreen.y
        if abs(dx) + abs(dy) > 3 { moved = true }
        if moved { window?.setFrameOrigin(NSPoint(x: windowOriginAtDown.x + dx, y: windowOriginAtDown.y + dy)) }
    }

    override func mouseUp(with event: NSEvent) {
        if moved { onMoveEnd?() } else if event.clickCount == 1 { bounce() }
    }

    override func menu(for event: NSEvent) -> NSMenu? {
        let menu = NSMenu()
        let open = NSMenuItem(title: "打开 AlreaDough", action: #selector(openSite), keyEquivalent: "")
        open.target = self
        menu.addItem(open)
        let sizeMenu = NSMenu()
        for (title, width) in [("小", 130.0), ("中", 190.0), ("大", 270.0)] {
            let item = NSMenuItem(title: title, action: #selector(chooseSize(_:)), keyEquivalent: "")
            item.target = self
            item.representedObject = width
            item.state = abs(CGFloat(width) - (window?.frame.width ?? 0)) < 2 ? .on : .off
            sizeMenu.addItem(item)
        }
        let sizeItem = NSMenuItem(title: "大小", action: nil, keyEquivalent: "")
        sizeItem.submenu = sizeMenu
        menu.addItem(sizeItem)
        menu.addItem(.separator())
        let quit = NSMenuItem(title: "退出桌宠", action: #selector(quitPet), keyEquivalent: "")
        quit.target = self
        menu.addItem(quit)
        return menu
    }

    @objc private func openSite() { NSWorkspace.shared.open(siteURL) }
    @objc private func chooseSize(_ sender: NSMenuItem) {
        if let width = sender.representedObject as? Double { onSizeChoice?(CGFloat(width)) }
    }
    @objc private func quitPet() { NSApp.terminate(nil) }
}

final class PetApp: NSObject, NSApplicationDelegate {
    private var panel: NSPanel!
    private var petView: PetView!
    private let aspect: CGFloat = 1024.0 / 1536.0

    func applicationDidFinishLaunching(_ notification: Notification) {
        guard let path = Bundle.main.path(forResource: "dough", ofType: "png"),
              let nsImage = NSImage(contentsOfFile: path),
              let cgImage = nsImage.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
            NSLog("dough.png is missing from the app")
            NSApp.terminate(nil)
            return
        }
        let width = CGFloat(defaults.double(forKey: "width") > 0 ? defaults.double(forKey: "width") : 190)
        let size = windowSize(forWidth: width)
        panel = NSPanel(contentRect: NSRect(origin: startOrigin(for: size), size: size),
                        styleMask: [.borderless, .nonactivatingPanel],
                        backing: .buffered, defer: false)
        panel.level = .floating
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = false
        panel.isMovable = false   // the view moves the window itself so a click does not become a drag
        panel.collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenAuxiliary, .ignoresCycle]
        petView = PetView(frame: NSRect(origin: .zero, size: size), image: cgImage)
        petView.autoresizingMask = [.width, .height]
        petView.onMoveEnd = { [weak self] in self?.saveOrigin() }
        petView.onSizeChoice = { [weak self] newWidth in self?.resize(toWidth: newWidth) }
        panel.contentView = petView
        panel.orderFrontRegardless()
    }

    private func windowSize(forWidth width: CGFloat) -> NSSize {
        NSSize(width: width, height: (width - 24) * aspect + 24)
    }

    private func startOrigin(for size: NSSize) -> NSPoint {
        if defaults.object(forKey: "x") != nil {
            let saved = NSPoint(x: defaults.double(forKey: "x"), y: defaults.double(forKey: "y"))
            let frame = NSRect(origin: saved, size: size)
            if NSScreen.screens.contains(where: { $0.visibleFrame.intersects(frame) }) { return saved }
        }
        let area = (NSScreen.main ?? NSScreen.screens[0]).visibleFrame
        return NSPoint(x: area.maxX - size.width - 40, y: area.minY + 40)
    }

    private func saveOrigin() {
        let origin = panel.frame.origin
        defaults.set(origin.x, forKey: "x")
        defaults.set(origin.y, forKey: "y")
    }

    private func resize(toWidth width: CGFloat) {
        let size = windowSize(forWidth: width)
        let old = panel.frame
        // keep the bottom edge and the centre where they were
        let origin = NSPoint(x: old.midX - size.width / 2, y: old.minY)
        panel.setFrame(NSRect(origin: origin, size: size), display: true, animate: true)
        defaults.set(Double(width), forKey: "width")
        saveOrigin()
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)   // no Dock icon, no menu bar
let delegate = PetApp()
app.delegate = delegate
app.run()
