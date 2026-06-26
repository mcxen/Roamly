import SwiftUI

// MARK: - Roamly Design Colors (shared, extracted from LibraryViewController)

extension Color {
    static let roamlyCanvas = Color(red: 0.95, green: 0.96, blue: 0.93)
    static let roamlyOlive = Color(red: 0.33, green: 0.38, blue: 0.24)
    static let roamlyGreen = Color(red: 0.20, green: 0.52, blue: 0.15)
}

// MARK: - About View

/// Roamly about page with SWDotSphere animated background.
struct RoamlyAboutView: View {
    var body: some View {
        ZStack {
            // Dot sphere background, dimmed for readability
            SWDotSphere(
                dotCount: 400,
                colors: [.blue, .indigo, .teal, .cyan],
                background: Color.roamlyCanvas,
                morphAmount: 0.85,
                rotationSpeed: 0.3,
                fadeSeconds: 6.0,
                waitSeconds: 4.0,
                dotSize: 2.5
            )
            .ignoresSafeArea()
            .overlay(Color.roamlyCanvas.opacity(0.55))
            .ignoresSafeArea()

            // About content
            VStack(spacing: 16) {
                Spacer().frame(height: 44)

                // App icon placeholder
                ZStack {
                    RoundedRectangle(cornerRadius: 28, style: .continuous)
                        .fill(.ultraThinMaterial)
                        .frame(width: 90, height: 90)
                    Image(systemName: "map.fill")
                        .font(.system(size: 40))
                        .foregroundStyle(Color.roamlyOlive)
                }
                .shadow(color: .black.opacity(0.08), radius: 12, y: 4)

                VStack(spacing: 4) {
                    Text("Roamly 漫游")
                        .font(.title2.weight(.bold))

                    Text("v0.1")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }

                VStack(spacing: 8) {
                    aboutRow(icon: "map", title: "地图浏览与标记", detail: "支持离线地图库，按地区与年代分类")
                    aboutRow(icon: "sparkles", title: "AI 元数据识别", detail: "OCR + AI 自动提取地图年代、地区和来源")
                    aboutRow(icon: "icloud.and.arrow.up", title: "云端同步", detail: "备份到自建服务端，支持 WebDAV")
                }
                .padding(.horizontal, 24)

                Spacer()

                // Footer
                VStack(spacing: 4) {
                    Text("由 OpenSpring 开发")
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                    Text("基于 ShipSwift 组件库")
                        .font(.caption2)
                        .foregroundStyle(.quaternary)
                }
                .padding(.bottom, 32)
            }
        }
    }

    private func aboutRow(icon: String, title: String, detail: String) -> some View {
        HStack(spacing: 14) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundStyle(Color.roamlyOlive)
                .frame(width: 28)

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.medium))
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()
        }
        .padding(14)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14))
    }
}

#Preview {
    RoamlyAboutView()
}
