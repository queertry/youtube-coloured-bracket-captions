# YouTube Coloured Bracket Captions

This addon colours text inside square brackets in YouTube captions, for example `[This text would be coloured]`. Caption authors often use brackets to caption text that is burned into the video, so colouring it makes it easy to tell apart from spoken dialogue.

## Disclaimer

This addon is not available anywhere else but here. I have not uploaded it to any official addon store or had any official team review the code. If you choose to install it, you do so at your own risk.

It requires Firefox 140 or newer. Auto-generated captions are not a target of this addon, since they do not use brackets for on-screen text.

## Settings

You can change your settings by left-clicking on the extension in your browser's toolbar. Changes apply immediately to open videos, even while paused.

| Name | Type | Default | Description
|------|------|---------|------------
| Colour bracketed caption text | boolean | true | Turns the colouring on or off.
| Colour of [bracketed] text | colour | `#ffd54a` | The colour used for bracketed text. The default amber stays readable on YouTube's semi-transparent black caption background and stands apart from the white dialogue. Pick it with the colour picker in the popup (drag in the square for saturation and brightness, on the strip for hue, or type a `#rgb` / `#rrggbb` code). Open videos update while you drag. The popup also shows a caption-style preview and has a button to reset to the default.

## Installation

Since this addon is unsigned you can only install it temporarily in a standard version of Firefox. To install it permanently, you must use either the Firefox Developer Version, a nightly version or the ESR build.

1. Install one of the above mentioned Firefox browsers
1. Browse to `about:config`
1. Search up the setting `xpinstall.signatures.required` and set it to `false`
1. Restart Firefox
1. Build the addon (see below) or download the .xpi file from the latest release, then either  
  a) drag and drop the file anywhere onto your browser  
  b) go to `about:addons` and use the cogwheel in the top right to `Install Add-On from File`

For development you can also load `manifest.json` from `about:debugging#/runtime/this-firefox` with `Load Temporary Add-on...`.

## For Development

### Creating a build

To create a build of this addon, run the [build.sh](build.sh) script, for example `./build.sh` or `./build.sh v1.0.0`. The result is written to `build/<version>/ycbc@queertry.com.xpi`. It has a few dependencies that may not be installed by default on your system:

* [esbuild](https://esbuild.github.io/) - used to bundle and minify the js files. The build script itself will also help you install it if necessary.
* [jq](https://jqlang.org/) - used to parse and edit the manifest.json file. This can usually be installed via a standard package manager, like `apt`
* `zip` - used to create the final .xpi file. This can also usually be installed via a standard package manager, like `apt`

### Icons

The logo is [src/icons/logo.svg](src/icons/logo.svg). After changing it, regenerate the PNGs, for example with `rsvg-convert`:

```bash
for s in 16 32 48 96 128; do rsvg-convert -w $s -h $s src/icons/logo.svg -o src/icons/png/icon-$s.png; done
```
