/**
 *
 *  QR Snapper
 *  Copyright 2018 Google Inc. All rights reserved.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License
 *
 */
import gulp from 'gulp';
import del from 'del';
import gulpLoadPlugins from 'gulp-load-plugins';
import rename from 'gulp-rename';
import * as rollupStream_ from 'rollup-stream';
import * as rollup_ from 'rollup';
import source from 'vinyl-source-stream';
import { terser } from 'rollup-plugin-terser';
import babel from 'rollup-plugin-babel';

const rollupStream = rollupStream_;
const rollup = rollup_;

const $ = gulpLoadPlugins();

// Optimize images
let images = () =>
  gulp.src('app/images/**/*')
    .pipe($.cache($.imagemin({
      progressive: true,
      interlaced: true
    })))
    .pipe(gulp.dest('dist/images'))
    .pipe($.size({title: 'images'}));

// Copy all files at the root level (app)
let copy = () =>
  gulp.src([
    'app/*',
    '!app/*.html'
  ], {
    dot: true
  }).pipe(gulp.dest('dist'))
    .pipe($.size({title: 'copy'}));

// Compile and automatically prefix stylesheets
let styles = () => {
  const AUTOPREFIXER_BROWSERS = [
    'ie >= 10',
    'ie_mob >= 10',
    'ff >= 30',
    'chrome >= 34',
    'safari >= 7',
    'opera >= 23',
    'ios >= 7',
    'android >= 4.4',
    'bb >= 10'
  ];

  // For best performance, don't add Sass partials to `gulp.src`
  return gulp.src([
    'app/styles/**/*.css'
  ])
    //.pipe($.newer('.tmp/styles'))
    .pipe($.autoprefixer(AUTOPREFIXER_BROWSERS))
    .pipe(gulp.dest('.tmp/styles'))
    .pipe($.concat('app.css'))
    // Concatenate and minify styles
    .pipe($.cssnano())
    .pipe($.size({title: 'styles'}))
    .pipe(gulp.dest('dist/styles'));
};

// Scan your HTML for assets & optimize them
let html = () => {
  return gulp.src('app/**/*.html')
    .pipe($.useref({
      searchPath: '{.tmp,app}',
      noAssets: true
    }))

    // Minify any HTML
    .pipe($.if('*.html', $.htmlmin({
      removeComments: true,
      collapseWhitespace: true,
      collapseBooleanAttributes: true,
      removeAttributeQuotes: true,
      removeRedundantAttributes: true,
      removeEmptyAttributes: true,
      removeScriptTypeAttributes: true,
      removeStyleLinkTypeAttributes: true,
      removeOptionalTags: true
    })))
    // Output files
    .pipe($.if('*.html', $.size({title: 'html', showFiles: true})))
    .pipe(gulp.dest('dist'));
};

gulp.task('webserver', function() {
  gulp.src('dist')
    .pipe($.webserver({
      host: '0.0.0.0',
      port: '8080',
      directoryListing: false
    }));
});

let clean = () => {
  return del(['.tmp', 'dist/*', '!dist/.git'], {dot: true});
};

let sw = () => {
  // Assume the SW can do everything modern except modules.
  return rollupStream({
    input: 'app/sw.js',
    rollup: rollup,
    output: {
      format: 'iife'
    },
    plugins: [
      terser()
    ]
  })
  .pipe(source('sw.js'))
  .pipe(gulp.dest('dist/'));
}

let worker_prep_lib = () => {
  // Get all the QR code libs and put them in a tmp dir
  return gulp
            .src('app/scripts/jsqrcode/*.js')
            .pipe($.concat('qrcode.js'))
            .pipe(gulp.dest('.tmp/scripts/'));
}

let worker_prep = () => {
  return gulp
            .src('app/scripts/*.js')
            .pipe(gulp.dest('.tmp/scripts/'));
}

let worker = () => {
  // Assume the worker can do everything modern except modules.
  return rollupStream({
      input: '.tmp/scripts/qrworker.js',
      rollup: rollup,
      output: {
        format: 'iife',
      },
      plugins: [
        babel({
          babelrc: false,
          presets: [['@babel/env',{"targets": { "chrome": "52" }}]],
          exclude: 'node_modules/**'
        }),
        terser()
      ]
    })
    .pipe(source('qrworker.js'))
    .pipe($.rename('qrworker.js'))
    .pipe(gulp.dest('dist/scripts/'));
}

let client_modules = () => {
  // Any browser that can load modules is totes amaze.
  return rollupStream({
      input: 'app/scripts/main.js',
      rollup: rollup,
      output: {
        format: 'es',
      },
      plugins: [
        terser()
      ]
    })
    .pipe(source('main.js'))
    .pipe(rename({extname: ".mjs"}))
    .pipe(gulp.dest('dist/scripts/'));
};

let client = () => {
  // Create the client JS for browsers that don't support modules. Aim for indexing.
  return rollupStream({
        input: 'app/scripts/main.js',
        rollup: rollup,
        output: {
          format: 'iife',
        },
        plugins: [
          babel({
            babelrc: false,
            presets: [['@babel/env',{"targets": { "chrome": "41" }}]],
            exclude: 'node_modules/**'
          }),
          terser()
        ]
      })
      .pipe(source('main.js'))
      .pipe(gulp.dest('dist/scripts/'));
};

let build = gulp.series(clean, copy, gulp.parallel(client, client_modules, sw, gulp.series(worker_prep_lib, worker_prep, worker), styles, html, images));

gulp.task('default', build); 