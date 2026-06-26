import UIKit
import SwiftUI

// MARK: - Toast State (iOS 16 compatible — ObservableObject instead of @Observable)

@MainActor
final class ToastState: ObservableObject {
    @Published var isShowing = false
    @Published var icon = "info.circle.fill"
    @Published var message = ""
    @Published var tintColor: Color = .primary

    func show(type: ToastOverlayBridge.ToastType, message: String) {
        self.icon = type.icon
        self.message = message
        self.tintColor = Color(uiColor: type.tintColor)
        self.isShowing = true
    }

    func dismiss() {
        self.isShowing = false
    }
}

// MARK: - Toast Overlay Bridge (UIKit Singleton)

@MainActor
final class ToastOverlayBridge {
    static let shared = ToastOverlayBridge()

    private weak var containerView: UIView?
    private var hostingController: UIHostingController<ToastOverlayRoot>?
    private var dismissWorkItem: DispatchWorkItem?

    private init() {}

    func attach(to parentView: UIView) {
        guard hostingController == nil else { return }

        let state = ToastState()
        let rootView = ToastOverlayRoot(state: state)
        let host = UIHostingController(rootView: rootView)
        host.view.backgroundColor = .clear
        host.view.translatesAutoresizingMaskIntoConstraints = false
        host.view.isUserInteractionEnabled = false

        parentView.addSubview(host.view)
        NSLayoutConstraint.activate([
            host.view.topAnchor.constraint(equalTo: parentView.topAnchor),
            host.view.leadingAnchor.constraint(equalTo: parentView.leadingAnchor),
            host.view.trailingAnchor.constraint(equalTo: parentView.trailingAnchor),
            host.view.heightAnchor.constraint(equalToConstant: 120)
        ])

        self.hostingController = host
        self.containerView = parentView
    }

    func show(_ type: ToastType, message: String, duration: TimeInterval = 2.0) {
        guard let host = hostingController else { return }

        dismissWorkItem?.cancel()
        host.rootView.state.show(type: type, message: message)

        let workItem = DispatchWorkItem { [weak self] in
            self?.hostingController?.rootView.state.dismiss()
        }
        dismissWorkItem = workItem
        DispatchQueue.main.asyncAfter(deadline: .now() + duration, execute: workItem)
    }

    func dismiss() {
        dismissWorkItem?.cancel()
        hostingController?.rootView.state.dismiss()
    }

    enum ToastType {
        case info
        case success
        case warning
        case error

        var icon: String {
            switch self {
            case .info: return "info.circle.fill"
            case .success: return "checkmark.circle.fill"
            case .warning: return "exclamationmark.triangle.fill"
            case .error: return "xmark.circle.fill"
            }
        }

        var tintColor: UIColor {
            switch self {
            case .info: return .label
            case .success: return .systemGreen
            case .warning: return .systemOrange
            case .error: return .systemRed
            }
        }
    }
}

// MARK: - Toast Overlay SwiftUI View (iOS 16 compatible)

struct ToastOverlayRoot: View {
    @ObservedObject var state: ToastState

    var body: some View {
        VStack {
            if state.isShowing {
                HStack(spacing: 6) {
                    Image(systemName: state.icon)
                        .font(.footnote)
                    Text(state.message)
                        .font(.footnote)
                        .multilineTextAlignment(.center)
                }
                .foregroundStyle(state.tintColor)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(
                    Capsule()
                        .fill(Material.ultraThin)
                )
                .overlay(
                    Capsule()
                        .stroke(state.tintColor.opacity(0.4), lineWidth: 0.5)
                )
                .transition(.scale.combined(with: .opacity))
                .padding(.top, 48)
            }
            Spacer()
        }
        .animation(.spring(duration: 0.3), value: state.isShowing)
    }
}

// MARK: - SwiftUI Bridge Helpers

@MainActor
enum SwiftUIBridge {
    /// Convenience: show a non-blocking toast.
    static func showToast(_ type: ToastOverlayBridge.ToastType, message: String, duration: TimeInterval = 2.0) {
        ToastOverlayBridge.shared.show(type, message: message, duration: duration)
    }

    /// Convenience: attach the toast overlay to a view controller's view.
    static func attachToastOverlay(to viewController: UIViewController) {
        ToastOverlayBridge.shared.attach(to: viewController.view)
    }
}

// MARK: - HostingController Helpers

extension UIViewController {
    /// Embeds a SwiftUI view into a child UIHostingController.
    func embedSwiftUIView<Content: View>(_ swiftUIView: Content, into container: UIView) {
        let host = UIHostingController(rootView: swiftUIView)
        addChild(host)
        host.view.translatesAutoresizingMaskIntoConstraints = false
        host.view.backgroundColor = .clear
        container.addSubview(host.view)
        NSLayoutConstraint.activate([
            host.view.topAnchor.constraint(equalTo: container.topAnchor),
            host.view.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            host.view.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            host.view.bottomAnchor.constraint(equalTo: container.bottomAnchor)
        ])
        host.didMove(toParent: self)
    }
}
