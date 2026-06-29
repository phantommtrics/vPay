const { withPodfile } = require('@expo/config-plugins');

const MARKER = 'Xcode 26+ workaround: fmt consteval';

const FMT_PATCH = `
    # ${MARKER} breaks with Apple Clang 21
    Dir.glob(File.join(installer.sandbox.root, 'fmt/include/fmt/base.h')).each do |file|
      contents = File.read(file)
      patched = contents.gsub(/#\\s*define FMT_USE_CONSTEVAL 1/, '#define FMT_USE_CONSTEVAL 0')
      if patched != contents
        File.chmod(0o644, file)
        File.write(file, patched)
      end
    end
`;

function withIosFmtXcode26Fix(config) {
  return withPodfile(config, (podfile) => {
    if (podfile.modResults.contents.includes(MARKER)) {
      return podfile;
    }

    podfile.modResults.contents = podfile.modResults.contents.replace(
      /react_native_post_install\([\s\S]*?\)\n/,
      (match) => `${match}${FMT_PATCH}`
    );

    return podfile;
  });
}

module.exports = withIosFmtXcode26Fix;
