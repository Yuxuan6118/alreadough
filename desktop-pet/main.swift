import AppKit

// AlreaDough desktop pet: the same dough as the web app, floating on the desktop. No check-in, no buttons.
// The look and the motion are a port of app/components/LivingDough.tsx and the .pet-* styles in already.css,
// so the dough behaves the same on the phone, in the browser and on the Mac.
//
//   idle         slow breathing, little proofing specks rise now and then          (same as the web dough)
//   click        squish and bounce, a ripple ring and 14 pieces of confetti         (same as the web dough)
//   pull         drag it and it stretches like dough, let go and it springs back  (same as the web dough)
//   pull far     keep pulling past the stretch limit and it breaks free and follows you; drop it anywhere
//   hold, move   or hold 0.4 s without moving, then drag: the same pick-up (it remembers the spot)
//   pinch        pinch with two fingers on the trackpad, or slide two fingers up/down on it: it grows or shrinks and
//                springs back when you let go (like the phone)
//   3 quick taps a proofing party: it puffs up and bursts into confetti             (new)
//   nap          untouched for 90 s it dozes, slower breathing and drifting z; point at it to wake it (new)
//   double-click opens AlreaDough in the browser
//   right-click  size, open AlreaDough, quit

let siteURL = URL(string: "https://alreadough.com")!
let defaults = UserDefaults.standard
// Room around the dough for stretching, ripples and confetti. It scales with the dough: a pulled dough grows past its own
// size, and anything beyond the window is cut off (that showed up as an invisible wall when pulling upwards).
func padFor(_ width: CGFloat) -> CGFloat { max(90, width * 0.64) }
var padding: CGFloat = padFor(190)

// MARK: colours (the web theme tokens)

func isDarkMode() -> Bool {
    NSApp.effectiveAppearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
}
func accent() -> NSColor { isDarkMode() ? NSColor(srgbRed: 0.82, green: 0.545, blue: 0.596, alpha: 1) : NSColor(srgbRed: 0.651, green: 0.373, blue: 0.42, alpha: 1) }   // #d18b98 / #a65f6b
func panelStrong() -> NSColor { isDarkMode() ? NSColor(srgbRed: 0.42, green: 0.29, blue: 0.31, alpha: 1) : NSColor(srgbRed: 0.914, green: 0.816, blue: 0.824, alpha: 1) } // #e9d0d2
let gold = NSColor(srgbRed: 0.835, green: 0.725, blue: 0.51, alpha: 1)                                                                                             // #d5b982

let webEase = CAMediaTimingFunction(controlPoints: 0.16, 1, 0.3, 1)   // cubic-bezier(.16,1,.3,1)

// confetti directions, copied from .pet-celebration i:nth-child(n)  (x, y in CSS pixels: y down)
let confettiSpots: [(x: CGFloat, y: CGFloat, r: CGFloat)] = [
    (-62, -68, -24), (-28, -86, 18), (10, -82, 42), (48, -64, 72), (70, -28, 94), (62, 22, 116), (28, 54, 148),
    (-14, 58, 184), (-52, 38, 214), (-72, 4, 244), (-76, -34, 282), (78, 8, 312), (34, -52, 338), (-36, -50, 8),
]

// MARK: the dough view

final class PetView: NSView {
    private let image: CGImage
    private let imageSize: CGSize               // the dough itself, without the padding
    private let pinchLayer = CALayer()          // two-finger pinch (trackpad)
    private let dragLayer = CALayer()           // stretch / pull / carry
    private let charLayer = CALayer()           // breathing and the click bounce
    private let fxLayer = CALayer()             // ripple, confetti, z
    private var specks: [CAShapeLayer] = []
    private var restTransform = CATransform3DIdentity

    private enum Mode { case idle, pending, pull, carry }
    private var mode = Mode.idle
    private var downScreen = NSPoint.zero
    private var windowAtDown = NSPoint.zero
    private var holdTimer: Timer?
    private var lastPull = CGPoint.zero
    private var lastStretch = CATransform3DIdentity
    private let breakFreeDistance: CGFloat = 92
    private var unit: CGFloat { imageSize.width / 190 }   // effects were drawn for a 190 pt dough; scale them with it
    private var tapTimes: [TimeInterval] = []
    private var lastTouched = Date()
    private var napping = false
    private var napTimer: Timer?

    var onCarryEnd: (() -> Void)?
    var onSizeChoice: ((CGFloat) -> Void)?
    var onResetPosition: (() -> Void)?

    init(image: CGImage, imageSize: CGSize) {
        self.image = image
        self.imageSize = imageSize
        super.init(frame: NSRect(x: 0, y: 0, width: imageSize.width + padding * 2, height: imageSize.height + padding * 2))
        wantsLayer = true
        layer = CALayer()
        layer?.backgroundColor = NSColor.clear.cgColor
        build()
        startBreathing(slow: false)
        startSpecks()
        napTimer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { [weak self] _ in self?.tick() }
    }

    required init?(coder: NSCoder) { fatalError("not used") }

    override var acceptsFirstResponder: Bool { true }
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }

    // the dough's own rectangle in screen coordinates (used for click-through and waking)
    func doughScreenRect() -> NSRect {
        guard let window = window else { return .zero }
        return NSRect(x: window.frame.minX + padding, y: window.frame.minY + padding, width: imageSize.width, height: imageSize.height)
    }

    // MARK: layers

    private func build() {
        let scale = NSScreen.main?.backingScaleFactor ?? 2
        let rect = CGRect(x: padding, y: padding, width: imageSize.width, height: imageSize.height)

        fxLayer.frame = bounds
        // web: .dough-drag-shell transform-origin 50% 58%  (from the top)  ->  anchor y = 0.42 from the bottom
        dragLayer.bounds = CGRect(origin: .zero, size: imageSize)
        dragLayer.anchorPoint = CGPoint(x: 0.5, y: 0.42)
        dragLayer.position = CGPoint(x: rect.midX, y: rect.minY + imageSize.height * 0.42)

        // web: .dough-character-shell transform-origin 50% 88%  ->  anchor y = 0.12 from the bottom
        charLayer.bounds = CGRect(origin: .zero, size: imageSize)
        charLayer.anchorPoint = CGPoint(x: 0.5, y: 0.12)
        charLayer.position = CGPoint(x: imageSize.width / 2, y: imageSize.height * 0.12)
        charLayer.contents = image
        charLayer.contentsGravity = .resizeAspect
        charLayer.contentsScale = scale
        // web: drop-shadow(0 16px 16px ink 18%)
        charLayer.shadowColor = (isDarkMode() ? NSColor.black : NSColor(srgbRed: 0.169, green: 0.141, blue: 0.137, alpha: 1)).cgColor
        charLayer.shadowOpacity = 0.18
        charLayer.shadowRadius = 8
        charLayer.shadowOffset = CGSize(width: 0, height: -16)

        dragLayer.addSublayer(charLayer)
        layer?.addSublayer(fxLayer)
        // pinch grows and shrinks the dough from its bottom edge, so it stays on the floor
        pinchLayer.bounds = CGRect(origin: .zero, size: bounds.size)
        pinchLayer.anchorPoint = CGPoint(x: 0.5, y: padding / bounds.height)
        pinchLayer.position = CGPoint(x: bounds.width / 2, y: padding)
        pinchLayer.addSublayer(dragLayer)
        layer?.addSublayer(pinchLayer)

        // web: .proof-specks (three small rings that float up and fade, 4.8 s, delays 0 / 1.55 / 3.1)
        let areaLeft = rect.minX + imageSize.width * 0.08, areaRight = rect.maxX - imageSize.width * 0.08
        let areaBottom = rect.minY + imageSize.height * 0.08, areaTop = rect.maxY - imageSize.height * 0.12
        let areaW = areaRight - areaLeft, areaH = areaTop - areaBottom
        let spots: [(CGPoint, CGFloat)] = [
            (CGPoint(x: areaLeft + areaW * 0.18 + 4, y: areaBottom + areaH * 0.24 + 4), 8),
            (CGPoint(x: areaRight - areaW * 0.19 - 3, y: areaTop - areaH * 0.28 - 3), 6),
            (CGPoint(x: areaRight - areaW * 0.28 - 2.5, y: areaBottom + areaH * 0.18 + 2.5), 5),
        ]
        for (center, size) in spots {
            let speck = CAShapeLayer()
            speck.bounds = CGRect(x: 0, y: 0, width: size, height: size)
            speck.position = center
            speck.path = CGPath(ellipseIn: speck.bounds.insetBy(dx: 0.5, dy: 0.5), transform: nil)
            speck.fillColor = nil
            speck.strokeColor = accent().withAlphaComponent(0.58).cgColor
            speck.lineWidth = 1
            speck.opacity = 0
            layer?.addSublayer(speck)
            specks.append(speck)
        }
    }

    // MARK: idle motion

    // web: scaleX [1,1.035,1], scaleY [1,1.055,1], y [0,-4,0] over 5.4 s, keys [0,.42,1], easeOut then easeInOut
    private func startBreathing(slow: Bool) {
        charLayer.removeAnimation(forKey: "breath-x"); charLayer.removeAnimation(forKey: "breath-y"); charLayer.removeAnimation(forKey: "breath-lift")
        let amount: CGFloat = slow ? 0.5 : 1
        let duration: CFTimeInterval = slow ? 8.4 : 5.4
        let make = { (path: String, base: CGFloat, peak: CGFloat) -> CAKeyframeAnimation in
            let animation = CAKeyframeAnimation(keyPath: path)
            animation.values = [base, peak, base]
            animation.keyTimes = [0, 0.42, 1]
            animation.timingFunctions = [CAMediaTimingFunction(name: .easeOut), CAMediaTimingFunction(name: .easeInEaseOut)]
            animation.duration = duration
            animation.repeatCount = .infinity
            return animation
        }
        charLayer.add(make("transform.scale.x", 1, 1 + 0.035 * amount), forKey: "breath-x")
        charLayer.add(make("transform.scale.y", 1, 1 + 0.055 * amount), forKey: "breath-y")
        charLayer.add(make("transform.translation.y", 0, 4 * amount * unit), forKey: "breath-lift")
    }

    private func startSpecks() {
        for (index, speck) in specks.enumerated() {
            let fade = CAKeyframeAnimation(keyPath: "opacity")
            fade.values = [0, 0, 0.72, 0, 0]
            fade.keyTimes = [0, 0.72, 0.82, 0.94, 1]
            let rise = CAKeyframeAnimation(keyPath: "transform.translation.y")
            rise.values = [-5 * unit, -5 * unit, 0, 18 * unit, -5 * unit]
            rise.keyTimes = [0, 0.72, 0.82, 0.94, 1]
            let grow = CAKeyframeAnimation(keyPath: "transform.scale")
            grow.values = [0.7, 0.7, 0.9, 1.08, 0.7]
            grow.keyTimes = [0, 0.72, 0.82, 0.94, 1]
            let group = CAAnimationGroup()
            group.animations = [fade, rise, grow]
            group.duration = 4.8
            group.repeatCount = .infinity
            group.beginTime = CACurrentMediaTime() + [0, 1.55, 3.1][index]
            group.fillMode = .backwards
            speck.add(group, forKey: "speck")
        }
    }

    // MARK: reactions

    // web: scaleX [1,1.05,.98,1], scaleY [1,.91,1.035,1], y [0,5,-2,0] over .7 s, ease (.16,1,.3,1)
    private func squish(strength: CGFloat = 1) {
        let make = { (path: String, values: [CGFloat]) -> CAKeyframeAnimation in
            let animation = CAKeyframeAnimation(keyPath: path)
            animation.values = values
            animation.keyTimes = [0, 0.33, 0.66, 1]
            animation.timingFunctions = Array(repeating: webEase, count: 3)
            animation.duration = 0.7
            animation.isAdditive = true
            return animation
        }
        // additive, so it plays on top of the breathing
        charLayer.add(make("transform.scale.x", [0, 0.05 * strength, -0.02 * strength, 0]), forKey: "squish-x")
        charLayer.add(make("transform.scale.y", [0, -0.09 * strength, 0.035 * strength, 0]), forKey: "squish-y")
        charLayer.add(make("transform.translation.y", [0, -5 * strength * unit, 2 * strength * unit, 0]), forKey: "squish-lift")
    }

    // web: .dough-ripple, 2px accent ring, opacity .52 -> 0, scale .2 -> 1.35 over .82 s
    private func ripple() {
        let size = imageSize.width * 0.64
        let ring = CAShapeLayer()
        ring.bounds = CGRect(x: 0, y: 0, width: size, height: size)
        ring.position = CGPoint(x: padding + imageSize.width / 2, y: padding + imageSize.height * 0.12 + size / 2)
        ring.path = CGPath(ellipseIn: ring.bounds.insetBy(dx: 1, dy: 1), transform: nil)
        ring.fillColor = nil
        ring.strokeColor = accent().cgColor
        ring.lineWidth = 2
        ring.opacity = 0
        fxLayer.addSublayer(ring)
        let fade = CABasicAnimation(keyPath: "opacity"); fade.fromValue = 0.52; fade.toValue = 0
        let grow = CABasicAnimation(keyPath: "transform.scale"); grow.fromValue = 0.2; grow.toValue = 1.35
        let group = CAAnimationGroup()
        group.animations = [fade, grow]
        group.duration = 0.82
        group.timingFunction = webEase
        group.isRemovedOnCompletion = false
        group.fillMode = .forwards
        ring.add(group, forKey: "ripple")
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.9) { ring.removeFromSuperlayer() }
    }

    // web: .pet-celebration, 14 pieces (7x12 pills), accent / panel-strong / gold, 0.9 s
    private func confetti(extra: Int = 0) {
        let centre = CGPoint(x: padding + imageSize.width / 2, y: padding + imageSize.height * 0.5)
        var spots = confettiSpots
        for index in 0..<extra {   // a bigger burst for the party
            let angle = CGFloat(index) / CGFloat(max(1, extra)) * 2 * .pi
            let reach = CGFloat.random(in: 70...105)
            spots.append((cos(angle) * reach, sin(angle) * reach, CGFloat.random(in: 0...360)))
        }
        for (index, spot) in spots.enumerated() {
            let piece = CALayer()
            piece.bounds = CGRect(x: 0, y: 0, width: 7 * unit, height: 12 * unit)
            piece.cornerRadius = 3.5 * unit
            piece.anchorPoint = CGPoint(x: 0, y: 1)
            piece.position = centre
            let number = index + 1
            piece.backgroundColor = (number % 3 == 0 ? panelStrong() : (number % 3 == 1 ? gold : accent())).cgColor
            fxLayer.addSublayer(piece)
            let move = CABasicAnimation(keyPath: "position")
            move.fromValue = NSValue(point: centre)
            move.toValue = NSValue(point: CGPoint(x: centre.x + spot.x * unit, y: centre.y - spot.y * unit))   // CSS y points down
            let turn = CABasicAnimation(keyPath: "transform.rotation.z")
            turn.fromValue = 0; turn.toValue = -spot.r * .pi / 180
            let fade = CABasicAnimation(keyPath: "opacity")
            fade.fromValue = 1; fade.toValue = 0
            let group = CAAnimationGroup()
            group.animations = [move, turn, fade]
            group.duration = 0.9
            group.timingFunction = webEase
            group.isRemovedOnCompletion = false
            group.fillMode = .forwards
            piece.add(group, forKey: "confetti")
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.95) { piece.removeFromSuperlayer() }
        }
    }

    private func respond() {
        squish()
        ripple()
        confetti()
    }

    // new: three quick taps = a proofing party
    private func party() {
        squish(strength: 1.7)
        ripple()
        confetti(extra: 18)
        let puff = CAKeyframeAnimation(keyPath: "transform.scale")
        puff.values = [1, 1.14, 0.97, 1.04, 1]
        puff.keyTimes = [0, 0.3, 0.55, 0.78, 1]
        puff.duration = 0.9
        puff.timingFunctions = Array(repeating: webEase, count: 4)
        dragLayer.add(puff, forKey: "puff")
    }

    // MARK: nap (new)

    private func tick() {
        guard mode == .idle else { return }
        if napping { driftZ(); return }
        if Date().timeIntervalSince(lastTouched) > 90 { fallAsleep() }
    }

    private func fallAsleep() {
        napping = true
        startBreathing(slow: true)
    }

    func wake(playful: Bool = true) {
        lastTouched = Date()
        guard napping else { return }
        napping = false
        startBreathing(slow: false)
        if playful { squish(strength: 0.7) }
    }

    func noteHover() { if napping { wake() } else { lastTouched = Date() } }

    private func driftZ() {
        let z = CATextLayer()
        z.string = "z"
        z.font = NSFont.systemFont(ofSize: 16, weight: .semibold)
        z.fontSize = CGFloat.random(in: 13...18) * unit
        z.foregroundColor = accent().withAlphaComponent(0.85).cgColor
        z.alignmentMode = .center
        z.contentsScale = NSScreen.main?.backingScaleFactor ?? 2
        z.bounds = CGRect(x: 0, y: 0, width: 20 * unit, height: 22 * unit)
        let start = CGPoint(x: padding + imageSize.width * 0.72, y: padding + imageSize.height * 0.78)
        z.position = start
        z.opacity = 0
        fxLayer.addSublayer(z)
        let rise = CABasicAnimation(keyPath: "position")
        rise.fromValue = NSValue(point: start)
        rise.toValue = NSValue(point: CGPoint(x: start.x + 14 * unit, y: start.y + 34 * unit))
        let fade = CAKeyframeAnimation(keyPath: "opacity")
        fade.values = [0, 1, 1, 0]
        fade.keyTimes = [0, 0.2, 0.7, 1]
        let group = CAAnimationGroup()
        group.animations = [rise, fade]
        group.duration = 2.4
        group.isRemovedOnCompletion = false
        group.fillMode = .forwards
        z.add(group, forKey: "z")
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.5) { z.removeFromSuperlayer() }
    }

    // MARK: pulling like dough (web: drag with elastic .22, stretch + tilt, spring back)

    // inside the limit it follows the mouse, beyond it only a fifth of the extra gets through
    private func elastic(_ value: CGFloat, low: CGFloat, high: CGFloat) -> CGFloat {
        if value > high { return high + (value - high) * 0.22 }
        if value < low { return low + (value - low) * 0.22 }
        return value
    }

    private func pull(dx: CGFloat, dy: CGFloat) {
        let tx = elastic(dx / unit, low: -52, high: 52)
        let ty = elastic(dy / unit, low: -22, high: 52)    // screen y points up: a downward pull has less room above the floor
        let ax = min(abs(tx), 76), ay = min(abs(ty), 76)
        let sx = 1 + ax / 150 - ay / 430
        let sy = 1 + ay / 150 - ax / 430
        let tilt = -(tx / 22) * .pi / 180
        var stretch = CATransform3DIdentity
        stretch = CATransform3DRotate(stretch, tilt, 0, 0, 1)
        stretch = CATransform3DScale(stretch, sx, sy, 1)
        lastPull = CGPoint(x: tx * unit, y: ty * unit)
        lastStretch = stretch
        let transform = CATransform3DConcat(stretch, CATransform3DMakeTranslation(tx * unit, ty * unit, 0))
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        dragLayer.removeAnimation(forKey: "spring")
        dragLayer.transform = transform
        CATransaction.commit()
    }

    // The dough has been pulled past its limit: it breaks free and the whole pet follows the mouse. The window moves
    // to where the dough looks right now, the stretch relaxes with a spring, so nothing jumps.
    private func breakFree() {
        guard let window = window else { return }
        mode = .carry
        windowAtDown = NSPoint(x: windowAtDown.x + lastPull.x, y: windowAtDown.y + lastPull.y)
        downScreen = NSEvent.mouseLocation
        let from = lastStretch
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        dragLayer.removeAnimation(forKey: "spring")
        dragLayer.transform = CATransform3DIdentity
        window.setFrameOrigin(windowAtDown)
        CATransaction.commit()
        let relax = CASpringAnimation(keyPath: "transform")
        relax.fromValue = NSValue(caTransform3D: from)
        relax.toValue = NSValue(caTransform3D: CATransform3DIdentity)
        relax.mass = 1; relax.stiffness = 380; relax.damping = 15
        relax.duration = relax.settlingDuration
        dragLayer.add(relax, forKey: "relax")
        let lift = CABasicAnimation(keyPath: "transform.scale")
        lift.toValue = 1.06; lift.duration = 0.18; lift.fillMode = .forwards; lift.isRemovedOnCompletion = false
        dragLayer.add(lift, forKey: "lift")
        NSHapticFeedbackManager.defaultPerformer.perform(.alignment, performanceTime: .now)
    }

    private func springBack() {
        let from = dragLayer.presentation()?.transform ?? dragLayer.transform
        let spring = CASpringAnimation(keyPath: "transform")
        spring.fromValue = NSValue(caTransform3D: from)
        spring.toValue = NSValue(caTransform3D: CATransform3DIdentity)
        spring.mass = 1; spring.stiffness = 420; spring.damping = 17; spring.initialVelocity = 0
        spring.duration = spring.settlingDuration
        dragLayer.transform = CATransform3DIdentity
        dragLayer.add(spring, forKey: "spring")
    }

    // MARK: pinch (same feel as the phone: follows the fingers, rubber at the limits, springs back with a wobble)

    private var pinchValue: CGFloat = 1
    private let minPinch: CGFloat = 0.55, maxPinch: CGFloat = 1.55

    private func rubber(_ value: CGFloat) -> CGFloat {
        if value > maxPinch { return maxPinch + (value - maxPinch) * 0.25 }
        if value < minPinch { return minPinch - (minPinch - value) * 0.25 }
        return value
    }

    private func applyPinch(factor: CGFloat) {
        pinchValue = rubber(pinchValue * factor)
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        pinchLayer.transform = CATransform3DMakeScale(pinchValue, pinchValue, 1)
        CATransaction.commit()
    }

    private func releasePinch() {
        scrollReleaseTimer?.invalidate()
        guard pinchValue != 1 else { return }
        let from = pinchLayer.presentation()?.transform ?? pinchLayer.transform
        let spring = CASpringAnimation(keyPath: "transform")
        spring.fromValue = NSValue(caTransform3D: from)
        spring.toValue = NSValue(caTransform3D: CATransform3DIdentity)
        spring.mass = 0.9; spring.stiffness = 230; spring.damping = 11
        spring.duration = spring.settlingDuration
        pinchLayer.transform = CATransform3DIdentity
        pinchLayer.add(spring, forKey: "pinch-spring")
        pinchValue = 1
    }

    // The pinch gesture itself. macOS does not always hand it to a floating window that is not in front.
    override func magnify(with event: NSEvent) {
        wake(playful: false)
        switch event.phase {
        case .began:
            pinchValue = 1
            pinchLayer.removeAnimation(forKey: "pinch-spring")
        case .changed:
            applyPinch(factor: 1 + event.magnification)
        case .ended, .cancelled:
            releasePinch()
        default: break
        }
    }

    // Two fingers sliding up or down on the trackpad (or a mouse wheel) with the pointer on the dough does the same thing.
    // Scroll events always reach the window under the pointer, so this works even when the pinch does not arrive.
    private var scrollReleaseTimer: Timer?
    override func scrollWheel(with event: NSEvent) {
        if event.momentumPhase != [] { return }          // the glide after the fingers lift is not part of the gesture
        wake(playful: false)
        let up = event.isDirectionInvertedFromDevice ? -event.scrollingDeltaY : event.scrollingDeltaY   // fingers moving up
        if event.phase == .began || event.phase == .mayBegin { pinchLayer.removeAnimation(forKey: "pinch-spring"); pinchValue = 1 }
        if up != 0 { applyPinch(factor: exp(up * 0.012)) }
        if event.phase == .ended || event.phase == .cancelled {
            releasePinch()
        } else if event.phase == [] {                    // a mouse wheel has no phases: let go when it goes quiet
            scrollReleaseTimer?.invalidate()
            scrollReleaseTimer = Timer.scheduledTimer(withTimeInterval: 0.2, repeats: false) { [weak self] _ in self?.releasePinch() }
        }
    }

    // MARK: mouse

    override func mouseDown(with event: NSEvent) {
        wake(playful: false)
        downScreen = NSEvent.mouseLocation
        windowAtDown = window?.frame.origin ?? .zero
        mode = .pending
        // web: whileTap scale .97
        let press = CABasicAnimation(keyPath: "transform.scale")
        press.toValue = 0.97; press.duration = 0.12; press.fillMode = .forwards; press.isRemovedOnCompletion = false
        dragLayer.add(press, forKey: "press")
        holdTimer?.invalidate()
        holdTimer = Timer.scheduledTimer(withTimeInterval: 0.4, repeats: false) { [weak self] _ in self?.pickUp() }
        if event.clickCount == 2 { NSWorkspace.shared.open(siteURL) }
    }

    private func pickUp() {
        guard mode == .pending else { return }
        mode = .carry
        dragLayer.removeAnimation(forKey: "press")
        let lift = CABasicAnimation(keyPath: "transform.scale")
        lift.toValue = 1.06; lift.duration = 0.18; lift.fillMode = .forwards; lift.isRemovedOnCompletion = false
        dragLayer.add(lift, forKey: "lift")
        NSHapticFeedbackManager.defaultPerformer.perform(.alignment, performanceTime: .now)
    }

    override func mouseDragged(with event: NSEvent) {
        let now = NSEvent.mouseLocation
        let dx = now.x - downScreen.x, dy = now.y - downScreen.y
        if mode == .pending, abs(dx) + abs(dy) > 4 {
            holdTimer?.invalidate()
            mode = .pull
            dragLayer.removeAnimation(forKey: "press")
        }
        switch mode {
        case .pull:
            if hypot(dx, dy) > breakFreeDistance * unit { breakFree() } else { pull(dx: dx, dy: dy) }
        case .carry: window?.setFrameOrigin(NSPoint(x: windowAtDown.x + dx, y: windowAtDown.y + dy))
        default: break
        }
    }

    override func mouseUp(with event: NSEvent) {
        holdTimer?.invalidate()
        dragLayer.removeAnimation(forKey: "press")
        switch mode {
        case .pull:
            springBack()
        case .carry:
            dragLayer.removeAnimation(forKey: "lift")
            let drop = CASpringAnimation(keyPath: "transform.scale")
            drop.fromValue = 1.06; drop.toValue = 1
            drop.mass = 1; drop.stiffness = 360; drop.damping = 14
            drop.duration = drop.settlingDuration
            dragLayer.add(drop, forKey: "drop")
            onCarryEnd?()
        case .pending:
            if event.clickCount == 1 {
                let stamp = Date().timeIntervalSince1970
                tapTimes = tapTimes.filter { stamp - $0 < 0.9 } + [stamp]
                if tapTimes.count >= 3 { tapTimes = []; party() } else { respond() }
            }
        case .idle: break
        }
        mode = .idle
        lastTouched = Date()
    }

    override func menu(for event: NSEvent) -> NSMenu? {
        let menu = NSMenu()
        let open = NSMenuItem(title: "打开 AlreaDough", action: #selector(openSite), keyEquivalent: "")
        open.target = self
        menu.addItem(open)
        let home = NSMenuItem(title: "放回屏幕右下角", action: #selector(goHome), keyEquivalent: "")
        home.target = self
        menu.addItem(home)
        let sizeMenu = NSMenu()
        let current = imageSize.width
        for (title, width) in [("特小", 130.0), ("小", 160.0), ("中", 190.0), ("大", 270.0), ("特大", 520.0)] {
            let item = NSMenuItem(title: title, action: #selector(chooseSize(_:)), keyEquivalent: "")
            item.target = self
            item.representedObject = width
            item.state = abs(CGFloat(width) - current) < 2 ? .on : .off
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
    @objc private func goHome() { onResetPosition?() }
    @objc private func chooseSize(_ sender: NSMenuItem) {
        if let width = sender.representedObject as? Double { onSizeChoice?(CGFloat(width)) }
    }
    @objc private func quitPet() { NSApp.terminate(nil) }

    var isBusy: Bool { mode != .idle }
}

// MARK: app

final class PetApp: NSObject, NSApplicationDelegate {
    private var panel: NSPanel!
    private var petView: PetView!
    private var image: CGImage!
    private let aspect: CGFloat = 1024.0 / 1536.0
    private var watcher: Timer?
    private var magnifyMonitor: Any?

    func applicationDidFinishLaunching(_ notification: Notification) {
        guard let path = Bundle.main.path(forResource: "dough", ofType: "png"),
              let nsImage = NSImage(contentsOfFile: path),
              let cgImage = nsImage.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
            NSLog("dough.png is missing from the app")
            NSApp.terminate(nil)
            return
        }
        image = cgImage
        let saved = defaults.double(forKey: "width2")
        showPet(width: saved > 0 ? CGFloat(saved) : 190, origin: nil)
        // Only the dough takes the mouse; the transparent margin lets clicks through to whatever is underneath.
        watcher = Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { [weak self] _ in self?.watchMouse() }
        // A floating, non-activating window does not always get trackpad gestures from the system. If the pinch is sent
        // elsewhere while the pointer rests on the dough, take it from the global stream (read-only; apps are unaffected).
        magnifyMonitor = NSEvent.addGlobalMonitorForEvents(matching: .magnify) { [weak self] event in
            guard let view = self?.petView, view.doughScreenRect().contains(NSEvent.mouseLocation) else { return }
            view.magnify(with: event)
        }
    }

    private func showPet(width: CGFloat, origin: NSPoint?) {
        padding = padFor(width)
        let imageSize = CGSize(width: width, height: width * aspect)
        let size = NSSize(width: imageSize.width + padding * 2, height: imageSize.height + padding * 2)
        panel?.orderOut(nil)
        let frameOrigin = origin ?? startOrigin(for: size)
        panel = NSPanel(contentRect: NSRect(origin: frameOrigin, size: size), styleMask: [.borderless, .nonactivatingPanel], backing: .buffered, defer: false)
        panel.level = .floating
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = false
        panel.isMovable = false
        panel.collectionBehavior = [.canJoinAllSpaces, .stationary, .fullScreenAuxiliary, .ignoresCycle]
        petView = PetView(image: image, imageSize: imageSize)
        petView.onCarryEnd = { [weak self] in self?.keepReachable() }
        petView.onResetPosition = { [weak self] in self?.goHome() }
        petView.onSizeChoice = { [weak self] newWidth in self?.resize(toWidth: newWidth) }
        panel.contentView = petView
        panel.orderFrontRegardless()
    }

    private func watchMouse() {
        guard let panel = panel, let petView = petView else { return }
        let inside = petView.doughScreenRect().contains(NSEvent.mouseLocation)
        panel.ignoresMouseEvents = !(inside || petView.isBusy)
        if inside { petView.noteHover() }
    }

    private func startOrigin(for size: NSSize) -> NSPoint {
        if defaults.object(forKey: "x") != nil {
            let saved = NSPoint(x: defaults.double(forKey: "x"), y: defaults.double(forKey: "y"))
            let frame = NSRect(origin: saved, size: size)
            if NSScreen.screens.contains(where: { $0.visibleFrame.intersects(frame) }) { return saved }
        }
        let area = (NSScreen.main ?? NSScreen.screens[0]).visibleFrame
        return NSPoint(x: area.maxX - 24 - (size.width - padding), y: area.minY + 16 - padding)
    }

    // Anywhere on any screen is fine, but at least half of the dough must stay on a screen so it can always be grabbed again.
    private func keepReachable() {
        guard let panel = panel else { return }
        let dough = NSRect(x: panel.frame.minX + padding, y: panel.frame.minY + padding, width: panel.frame.width - padding * 2, height: panel.frame.height - padding * 2)
        let screens = NSScreen.screens.map { $0.frame }
        let screen = screens.max(by: { $0.intersection(dough).width * $0.intersection(dough).height < $1.intersection(dough).width * $1.intersection(dough).height }) ?? (NSScreen.main?.frame ?? .zero)
        let slackX = dough.width * 0.5, slackY = dough.height * 0.5
        var shiftX: CGFloat = 0, shiftY: CGFloat = 0
        if dough.minX < screen.minX - slackX { shiftX = screen.minX - slackX - dough.minX }
        if dough.maxX > screen.maxX + slackX { shiftX = screen.maxX + slackX - dough.maxX }
        if dough.minY < screen.minY - slackY { shiftY = screen.minY - slackY - dough.minY }
        if dough.maxY > screen.maxY + slackY { shiftY = screen.maxY + slackY - dough.maxY }
        if shiftX != 0 || shiftY != 0 {
            var frame = panel.frame
            frame.origin.x += shiftX; frame.origin.y += shiftY
            panel.setFrame(frame, display: true, animate: true)
        }
        saveOrigin()
    }

    private func goHome() {
        guard let panel = panel else { return }
        let area = (NSScreen.main ?? NSScreen.screens[0]).visibleFrame
        let origin = NSPoint(x: area.maxX - 24 - (panel.frame.width - padding), y: area.minY + 16 - padding)
        panel.setFrame(NSRect(origin: origin, size: panel.frame.size), display: true, animate: true)
        saveOrigin()
    }

    private func saveOrigin() {
        let origin = panel.frame.origin
        defaults.set(origin.x, forKey: "x")
        defaults.set(origin.y, forKey: "y")
    }

    private func resize(toWidth width: CGFloat) {
        let old = panel.frame
        let oldPad = padding
        let newPad = padFor(width)
        let doughBottom = old.minY + oldPad
        let origin = NSPoint(x: old.midX - (width + newPad * 2) / 2, y: doughBottom - newPad)
        defaults.set(Double(width), forKey: "width2")
        defaults.set(Double(origin.x), forKey: "x")
        defaults.set(Double(origin.y), forKey: "y")
        showPet(width: width, origin: origin)
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)   // no Dock icon, no menu bar
let delegate = PetApp()
app.delegate = delegate
app.run()
