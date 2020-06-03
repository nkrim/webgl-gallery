module.exports = {
    mode: "development",

    entry: "./src/js/app.js",
    devtool: 'source-map',
    output: {
        path: '/',
        filename: "bundle.js"
    },
    resolve: {
        extensions: [".ts", ".tsx", ".js", ".json"]
    },
    module: {
        rules: [
            // all files with a '.ts' or '.tsx' extension will be handled by 'ts-loader'
            { test: /\.tsx?$/, use: ["awesome-typescript-loader"] }
        ]
    }
}