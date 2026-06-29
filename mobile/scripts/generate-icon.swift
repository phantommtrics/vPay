#!/usr/bin/env swift
import AppKit
import Foundation

let args = CommandLine.arguments
guard args.count >= 2 else {
    fputs("Usage: generate-icon.swift <output.png>\n", stderr)
    exit(1)
}

let outPath = args[1]
let size = 1024
let canvas = CGFloat(size)

guard let rep = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: size,
    pixelsHigh: size,
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0,
    bitsPerPixel: 0
) else {
    fputs("Failed to create bitmap\n", stderr)
    exit(1)
}

NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)

NSColor(red: 0.925, green: 0.992, blue: 0.961, alpha: 1).setFill()
NSBezierPath(rect: NSRect(x: 0, y: 0, width: canvas, height: canvas)).fill()

let vPayFontSize: CGFloat = 196
let africaFontSize: CGFloat = 60
let africaKern: CGFloat = 17
let lineHeight: CGFloat = 10
let lineWidth: CGFloat = 350
let vPayAfricaGap: CGFloat = 18
let africaLineGap: CGFloat = 16

let vPay = NSMutableAttributedString(string: "VPay", attributes: [
    .font: NSFont.systemFont(ofSize: vPayFontSize, weight: .bold),
    .kern: -2.5,
])
vPay.addAttribute(.foregroundColor, value: NSColor(red: 0.145, green: 0.388, blue: 0.922, alpha: 1), range: NSRange(location: 0, length: 1))
vPay.addAttribute(.foregroundColor, value: NSColor(red: 0.118, green: 0.251, blue: 0.686, alpha: 1), range: NSRange(location: 1, length: 3))

let africa = NSAttributedString(string: "AFRICA", attributes: [
    .font: NSFont.systemFont(ofSize: africaFontSize, weight: .semibold),
    .foregroundColor: NSColor(red: 0.392, green: 0.455, blue: 0.545, alpha: 1),
    .kern: africaKern,
])

let vPaySize = vPay.size()
let africaSize = africa.size()
let blockHeight = vPaySize.height + vPayAfricaGap + africaSize.height + africaLineGap + lineHeight
let blockBottom = (canvas - blockHeight) / 2

let lineRect = NSRect(
    x: (canvas - lineWidth) / 2,
    y: blockBottom,
    width: lineWidth,
    height: lineHeight
)
NSColor(red: 0.020, green: 0.588, blue: 0.412, alpha: 1).setFill()
NSBezierPath(roundedRect: lineRect, xRadius: 5, yRadius: 5).fill()

let africaOrigin = NSPoint(
    x: (canvas - africaSize.width) / 2,
    y: blockBottom + lineHeight + africaLineGap
)
africa.draw(at: africaOrigin)

let vPayOrigin = NSPoint(
    x: (canvas - vPaySize.width) / 2,
    y: blockBottom + lineHeight + africaLineGap + africaSize.height + vPayAfricaGap
)
vPay.draw(at: vPayOrigin)

NSGraphicsContext.restoreGraphicsState()

guard let data = rep.representation(using: .png, properties: [:]) else {
    fputs("Failed to encode PNG\n", stderr)
    exit(1)
}

try data.write(to: URL(fileURLWithPath: outPath))
