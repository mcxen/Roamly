import UIKit

final class Haptics {
  static let shared = Haptics()

  private let selectionGenerator = UISelectionFeedbackGenerator()
  private let softImpactGenerator = UIImpactFeedbackGenerator(style: .light)
  private let mediumImpactGenerator = UIImpactFeedbackGenerator(style: .medium)
  private let successGenerator = UINotificationFeedbackGenerator()
  private let warningGenerator = UINotificationFeedbackGenerator()
  private let errorGenerator = UINotificationFeedbackGenerator()

  private init() {}

  func prepare() {
    selectionGenerator.prepare()
    softImpactGenerator.prepare()
    mediumImpactGenerator.prepare()
    successGenerator.prepare()
    warningGenerator.prepare()
    errorGenerator.prepare()
  }

  func selectionChanged() {
    selectionGenerator.selectionChanged()
    selectionGenerator.prepare()
  }

  func softTap() {
    softImpactGenerator.impactOccurred(intensity: 0.75)
    softImpactGenerator.prepare()
  }

  func mediumTap() {
    mediumImpactGenerator.impactOccurred(intensity: 0.9)
    mediumImpactGenerator.prepare()
  }

  func success() {
    successGenerator.notificationOccurred(.success)
    successGenerator.prepare()
  }

  func warning() {
    warningGenerator.notificationOccurred(.warning)
    warningGenerator.prepare()
  }

  func error() {
    errorGenerator.notificationOccurred(.error)
    errorGenerator.prepare()
  }
}
