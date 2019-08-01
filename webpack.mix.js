const mix = require('laravel-mix')
const fs = require('fs-extra')
const multimatch = require('multimatch')
const SVGSpritemapPlugin = require('svg-spritemap-webpack-plugin')
require('laravel-mix-polyfill')
require('laravel-mix-copy-watched')
require('laravel-mix-eslint')
require('laravel-mix-stylelint')
require('laravel-mix-imagemin')
require('laravel-mix-ejs')

const srcRelativePath =
  (process.env.MIX_SRC_RELATIVE_PATH || 'resources')
    .replace(/\/$/, '')
const distRelativePath =
  (process.env.MIX_DIST_RELATIVE_PATH || 'public')
    .replace(/\/$/, '')
const basePath =
  (process.env.MIX_BASE_PATH || '')
    .replace(/\/$/, '')

fs.removeSync(distRelativePath)

mix
  .setPublicPath(distRelativePath) // *1
  .polyfill()
  .js(
    `${srcRelativePath}/assets/js/app.js`,
    `${distRelativePath}/assets/js`
  )
  .eslint()
  .sass(
    `${srcRelativePath}/assets/css/app.scss`,
    `${distRelativePath}/assets/css`
  )
  .stylelint()
  .options({ processCssUrls: false })
  .webpackConfig({
    plugins: [
      new SVGSpritemapPlugin(
        `${srcRelativePath}/assets/svg/sprite/*.svg`, // *2
        {
          output: {
            filename: 'assets/svg/sprite.svg',
            chunk: {
              name: 'assets/js/.svg-dummy-module',
              keep: true // *3
            },
            svgo: {
              plugins: [
                { addClassesToSVGElement: { className: 'svg-sprite' } } // *4
              ]
            },
            svg4everybody: true
          }
        }
      )
    ]
  })
  .copyWatched( // *5
    [
      `${srcRelativePath}/assets/svg/!(sprite)`,
      `${srcRelativePath}/assets/svg/!(sprite)/**/*`
    ],
    `${distRelativePath}/assets/svg`,
    { base: `${srcRelativePath}/assets/svg` }
  )
  .browserSync({ // *6
    open: false,
    host: process.env.MIX_BROWSER_SYNC_HOST || 'localhost',
    port: process.env.MIX_BROWSER_SYNC_PORT || 3000,
    proxy: false,
    server: distRelativePath,
    files: [
      `${distRelativePath}/assets/**/*`, // *7
      `${distRelativePath}/**/*.html`
    ],
    https:
      process.env.MIX_BROWSER_SYNC_HTTPS_CERT &&
      process.env.MIX_BROWSER_SYNC_HTTPS_KEY
        ? {
          cert: process.env.MIX_BROWSER_SYNC_HTTPS_CERT,
          key: process.env.MIX_BROWSER_SYNC_HTTPS_KEY
        }
        : false
  })
  .sourceMaps(false, 'inline-cheap-module-source-map') // *8
  .ejs(
    `${srcRelativePath}/views`,
    distRelativePath,
    {
        mix: (filePath = '') => // *9
          process.env.NODE_ENV === 'production'
            ? basePath + filePath + '?id=' + Date.now()
            : basePath + filePath,
        svgSprite: (filePath = '', id = '') => // *10
          process.env.NODE_ENV === 'production'
            ? id
            : basePath + filePath + id
    },
    {
      base: `${srcRelativePath}/views`,
      root: `${srcRelativePath}/views`,
      partials: `${srcRelativePath}/views/partials`
    }
  )

if (process.env.NODE_ENV === 'production') {
  mix
    .imagemin(
      [ 'assets/images/**/*' ],
      { context: srcRelativePath },
      {
        test: filePath => !!multimatch(filePath, [ 'assets/images/**/*' ]).length, // *11
        pngquant: { strip: true, quality: 100-100 }, // 0 ~ 100
        gifsicle: { optimizationLevel: 1 }, // 1 ~ 3
        plugins: [ require('imagemin-mozjpeg')({ quality: 100 }) ] // 0 ~ 100
      }
    )
    .then(() => {
      fs.removeSync(`${distRelativePath}/assets/js/.svg-dummy-module.js`) // *12
      fs.removeSync(`${distRelativePath}/mix-manifest.json`) // *13
    })
}

else {
  mix
    .copyWatched( // *14
      `${srcRelativePath}/assets/images`,
      `${distRelativePath}/assets/images`,
      { base: `${srcRelativePath}/assets/images` }
    )
}

/*

*1
`setPublicPath()` is required.
Because it determines directory where mix-manifest.json is output.

*2
Following setting must not be set.
`${srcRelativePath}/assets/svg/sprite/** /*.svg`
Because, file name determines id attribute, so all target file names must be unique.

*3
Keep chunk file without deletion.
Because error occurs if chunk file has deleted when creating mix-manifest.json.

*4
`svg-sprite` class is required.
Because it has style to hide sprite.

*5
This method copies SVG that is not sprite.

*6
Although reloading is necessary to see changes of the SVG file,
BrowserSync executes ingection instead of reloading when changing SVG.
Options of BrowserSync can not change this behavior.
https://github.com/BrowserSync/browser-sync/issues/1287

*7
Following setting must not be set.
`${distRelativePath}/** /*`
Because injection of changes such as CSS will be not available.
https://github.com/JeffreyWay/laravel-mix/issues/1053

*8
Note that several types don't output map for CSS.
https://webpack.js.org/configuration/devtool/#devtool

*9
This function mimics `mix()` of Laravel Mix.

*10
This function creates path for SVG sprite.
In production, sprite is embed as inline code, and referenced with id without request.
In development, sprite is not embed, but requested with filepath argument as another file.
If embed in development, EJS recompilation and browser reloading are caused
by SVGSpritemapPlugin, no matter what changes.

*11
`test` option is required.
Because imagemin can not find targets exactly without this function.

*12
This is unnecessary chunk file created by SVGSpritemapPlugin.

*13
This is file that is referenced for versioning.
It is unnecessary unless server-side script is used.

*14
It is unnecessary to optimize images in development mode.

*/
