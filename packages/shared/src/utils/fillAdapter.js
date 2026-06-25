function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}
function toHex6(color) {
    if (typeof color !== "string")
        return undefined;
    if (/^#[0-9a-fA-F]{8}$/.test(color))
        return color.slice(0, 7).toUpperCase();
    if (/^#[0-9a-fA-F]{6}$/.test(color))
        return color.toUpperCase();
    return undefined;
}
function gradientStopsToCss(stops) {
    if (!stops || stops.length === 0)
        return "#000000 0%, #FFFFFF 100%";
    return stops
        .map((stop, index) => {
        const color = toHex6(stop.color) ?? "#000000";
        const rawPosition = isFiniteNumber(stop.position)
            ? stop.position
            : index === stops.length - 1
                ? 1
                : 0;
        const percent = Math.max(0, Math.min(100, Math.round(rawPosition * 100)));
        return `${color} ${percent}%`;
    })
        .join(", ");
}
export function fillsToCssBackgroundStyle(fills) {
    if (!fills)
        return {};
    for (let i = fills.length - 1; i >= 0; i--) {
        const fill = fills[i];
        if (fill?.enabled === false)
            continue;
        switch (fill?.type) {
            case "color": {
                const color = toHex6(fill.color);
                return color ? { backgroundColor: color } : {};
            }
            case "linear-gradient": {
                const rotation = isFiniteNumber(fill.rotation) ? fill.rotation : 0;
                return {
                    backgroundImage: `linear-gradient(${rotation}deg, ${gradientStopsToCss(fill.stops)})`,
                };
            }
            case "radial-gradient": {
                const cx = isFiniteNumber(fill.center?.x)
                    ? Math.round(fill.center.x * 100)
                    : 50;
                const cy = isFiniteNumber(fill.center?.y)
                    ? Math.round(fill.center.y * 100)
                    : 50;
                return {
                    backgroundImage: `radial-gradient(circle at ${cx}% ${cy}%, ${gradientStopsToCss(fill.stops)})`,
                };
            }
            case "angular-gradient": {
                const rotation = isFiniteNumber(fill.rotation) ? fill.rotation : 0;
                const cx = isFiniteNumber(fill.center?.x)
                    ? Math.round(fill.center.x * 100)
                    : 50;
                const cy = isFiniteNumber(fill.center?.y)
                    ? Math.round(fill.center.y * 100)
                    : 50;
                return {
                    backgroundImage: `conic-gradient(from ${rotation}deg at ${cx}% ${cy}%, ${gradientStopsToCss(fill.stops)})`,
                };
            }
            case "image": {
                if (typeof fill.url !== "string" || fill.url.length === 0)
                    return {};
                const backgroundSize = fill.mode === "stretch"
                    ? "100% 100%"
                    : fill.mode === "fit"
                        ? "contain"
                        : "cover";
                return {
                    backgroundImage: `url(${fill.url})`,
                    backgroundSize,
                };
            }
            case "mesh-gradient": {
                const points = Array.isArray(fill.points) ? fill.points : [];
                if (points.length < 4)
                    return {};
                const tl = toHex6(points[0]?.color) ?? "#FF0000";
                const tr = toHex6(points[1]?.color) ?? "#FFFF00";
                const bl = toHex6(points[2]?.color) ?? "#0000FF";
                const br = toHex6(points[3]?.color) ?? "#00FF00";
                const svg = [
                    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%">',
                    "<defs>",
                    `<linearGradient id="t"><stop offset="0" stop-color="${tl}"/><stop offset="1" stop-color="${tr}"/></linearGradient>`,
                    `<linearGradient id="b"><stop offset="0" stop-color="${bl}"/><stop offset="1" stop-color="${br}"/></linearGradient>`,
                    '<linearGradient id="m" x2="0" y2="1"><stop offset="0" stop-color="white"/><stop offset="1" stop-color="black"/></linearGradient>',
                    '<mask id="fade"><rect width="100" height="100" fill="url(#m)"/></mask>',
                    "</defs>",
                    '<rect width="100" height="100" fill="url(#b)"/>',
                    '<rect width="100" height="100" fill="url(#t)" mask="url(#fade)"/>',
                    "</svg>",
                ].join("");
                return {
                    backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
                    backgroundSize: "100% 100%",
                };
            }
            default:
                continue;
        }
    }
    return {};
}
export function adaptStyleWithFills(style, fills) {
    if (!fills)
        return style;
    const nextStyle = { ...(style ?? {}) };
    delete nextStyle.backgroundColor;
    delete nextStyle.backgroundImage;
    delete nextStyle.backgroundSize;
    return {
        ...nextStyle,
        ...fillsToCssBackgroundStyle(fills),
    };
}
export function adaptElementFillStyle(element) {
    if (!("fills" in element))
        return element;
    return {
        ...element,
        props: {
            ...(element.props ?? {}),
            style: adaptStyleWithFills(element.props?.style, element.fills),
        },
    };
}
//# sourceMappingURL=fillAdapter.js.map