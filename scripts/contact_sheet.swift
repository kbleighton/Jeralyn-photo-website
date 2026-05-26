import AppKit
import Foundation

struct Config {
    let inputDir: String
    let outputFile: String
    let columns: Int
    let startIndex: Int
    let count: Int?
}

func parseArgs() -> Config? {
    let args = CommandLine.arguments
    guard args.count >= 3 else {
        fputs("Usage: swift contact_sheet.swift <input-dir> <output-file> [columns] [start-index] [count]\n", stderr)
        return nil
    }

    let columns = args.count >= 4 ? max(Int(args[3]) ?? 4, 1) : 4
    let startIndex = args.count >= 5 ? max((Int(args[4]) ?? 1) - 1, 0) : 0
    let count = args.count >= 6 ? max(Int(args[5]) ?? 0, 0) : nil
    return Config(inputDir: args[1], outputFile: args[2], columns: columns, startIndex: startIndex, count: count)
}

func drawWrapped(_ text: String, in rect: NSRect) {
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = .center
    paragraph.lineBreakMode = .byWordWrapping

    let attributes: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: 18, weight: .medium),
        .foregroundColor: NSColor(calibratedWhite: 0.12, alpha: 1),
        .paragraphStyle: paragraph
    ]

    text.draw(with: rect, options: [.usesLineFragmentOrigin, .usesFontLeading], attributes: attributes)
}

guard let config = parseArgs() else {
    exit(1)
}

let fileManager = FileManager.default
let inputURL = URL(fileURLWithPath: config.inputDir)
let outputURL = URL(fileURLWithPath: config.outputFile)

guard let enumerator = fileManager.enumerator(at: inputURL, includingPropertiesForKeys: nil) else {
    fputs("Unable to enumerate \(config.inputDir)\n", stderr)
    exit(1)
}

let imageURLs = enumerator.compactMap { $0 as? URL }
    .filter { ["jpg", "jpeg", "png", "heic"].contains($0.pathExtension.lowercased()) }
    .sorted { $0.lastPathComponent.localizedStandardCompare($1.lastPathComponent) == .orderedAscending }

guard !imageURLs.isEmpty else {
    fputs("No images found in \(config.inputDir)\n", stderr)
    exit(1)
}

let slicedImageURLs: [URL]
if let count = config.count {
    slicedImageURLs = Array(imageURLs.dropFirst(config.startIndex).prefix(count))
} else {
    slicedImageURLs = Array(imageURLs.dropFirst(config.startIndex))
}

guard !slicedImageURLs.isEmpty else {
    fputs("No images in requested range for \(config.inputDir)\n", stderr)
    exit(1)
}

let margin: CGFloat = 32
let gap: CGFloat = 18
let labelHeight: CGFloat = 56
let thumbWidth: CGFloat = 260
let thumbHeight: CGFloat = 260
let cellWidth = thumbWidth
let cellHeight = thumbHeight + labelHeight
let columns = CGFloat(config.columns)
let rows = ceil(CGFloat(slicedImageURLs.count) / columns)

let canvasWidth = margin * 2 + (thumbWidth * columns) + (gap * (columns - 1))
let canvasHeight = margin * 2 + (cellHeight * rows) + (gap * max(rows - 1, 0))

let image = NSImage(size: NSSize(width: canvasWidth, height: canvasHeight))
image.lockFocus()

NSColor(calibratedWhite: 0.97, alpha: 1).setFill()
NSBezierPath(rect: NSRect(x: 0, y: 0, width: canvasWidth, height: canvasHeight)).fill()

for (index, url) in slicedImageURLs.enumerated() {
    guard let source = NSImage(contentsOf: url) else { continue }

    let row = CGFloat(index / config.columns)
    let col = CGFloat(index % config.columns)

    let x = margin + col * (cellWidth + gap)
    let topY = canvasHeight - margin - row * (cellHeight + gap)
    let imageRect = NSRect(x: x, y: topY - thumbHeight, width: thumbWidth, height: thumbHeight)

    let bounds = NSRect(origin: .zero, size: source.size)
    let scale = min(thumbWidth / bounds.width, thumbHeight / bounds.height)
    let drawWidth = bounds.width * scale
    let drawHeight = bounds.height * scale
    let centeredRect = NSRect(
        x: imageRect.origin.x + (thumbWidth - drawWidth) / 2,
        y: imageRect.origin.y + (thumbHeight - drawHeight) / 2,
        width: drawWidth,
        height: drawHeight
    )

    NSColor.white.setFill()
    NSBezierPath(roundedRect: imageRect, xRadius: 10, yRadius: 10).fill()
    source.draw(in: centeredRect, from: bounds, operation: .sourceOver, fraction: 1)

    NSColor(calibratedWhite: 0.85, alpha: 1).setStroke()
    NSBezierPath(roundedRect: imageRect, xRadius: 10, yRadius: 10).stroke()

    let labelRect = NSRect(x: x, y: imageRect.origin.y - labelHeight + 6, width: cellWidth, height: labelHeight - 8)
    let label = "\(config.startIndex + index + 1). \(url.lastPathComponent)"
    drawWrapped(label, in: labelRect)
}

image.unlockFocus()

guard let tiff = image.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: tiff),
      let data = bitmap.representation(using: .jpeg, properties: [.compressionFactor: 0.9]) else {
    fputs("Unable to render output image\n", stderr)
    exit(1)
}

do {
    try data.write(to: outputURL)
} catch {
    fputs("Unable to write \(config.outputFile): \(error)\n", stderr)
    exit(1)
}

print(outputURL.path)
