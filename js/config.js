export const ballTypes = [
    {
        index: 0,
        color: "white",
        type: "solid",
    },
    {
        index: 1,
        color: "yellow",
        type: "solid",
    },
    {
        index: 2,
        color: "blue",
        type: "solid",
    },
    {
        index: 3,
        color: "red",
        type: "solid",
    },
    {
        index: 4,
        color: "purple",
        type: "solid",
    },
    {
        index: 5,
        color: "orange",
        type: "solid",
    },
    {
        index: 6,
        color: "green",
        type: "solid",
    },
    {
        index: 7,
        color: "maroon",
        type: "solid",
    },
    {
        index: 8,
        color: "black",
        type: "solid",
    },
    {
        index: 9,
        color: "yellow",
        type: "stripe",
    },
    {
        index: 10,
        color: "blue",
        type: "stripe",
    },
    {
        index: 11,
        color: "red",
        type: "stripe",
    },
    {
        index: 12,
        color: "purple",
        type: "stripe",
    },
    {
        index: 13,
        color: "orange",
        type: "stripe",
    },
    {
        index: 14,
        color: "green",
        type: "stripe",
    },
    {
        index: 15,
        color: "maroon",
        type: "stripe",
    },
];


export function getBallPalette(color) {
    const palettes = {
        white: ["#ffffff", "#dce6ee", "#7d8c99"],
        yellow: ["#fff38a", "#e4b900", "#725300"],
        blue: ["#a7caf4", "#0e58c5", "#031e3d"],
        red: ["#ffaaa2", "#d52d25", "#5c0908"],
        purple: ["#d9a6f5", "#7937a8", "#2d0d45"],
        orange: ["#ffd09a", "#ed7a18", "#743006"],
        green: ["#a8e0a1", "#23833b", "#082f16"],
        maroon: ["#d89999", "#7b2028", "#31090d"],
        black: ["#8f9aa4", "#202932", "#05080b"]
    };

    return palettes[color] || palettes.white;
}
