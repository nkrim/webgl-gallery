const { src, dest, series, parallel, lastRun } = require('gulp');
const del = require('del');
const newer = require('gulp-newer');
const ts = require('gulp-typescript');
const tsProject = ts.createProject('tsconfig.json');
const webpack = require('webpack-stream');

function pack() {
    return src('src/js/app.js')
        .pipe(webpack(require('./webpack.config.js')))
        .pipe(dest('build/js'));
};

function copy_to_dist() {
	return src(['src/*.html', 'src/**/*.{vert,frag}'])
		.pipe(dest('build'));
}

function clean() {
	return del('build/*');
}

// EXPORTS
exports.default = series(clean, parallel(copy_to_dist, pack));