{pkgs}: {
  deps = [
    pkgs.mesa
    pkgs.xorg.libXtst
    pkgs.xorg.libXi
    pkgs.xorg.libxcb
    pkgs.xorg.libXrandr
    pkgs.xorg.libXfixes
    pkgs.xorg.libXext
    pkgs.xorg.libXdamage
    pkgs.xorg.libXcomposite
    pkgs.xorg.libX11
    pkgs.expat
    pkgs.libxkbcommon
    pkgs.libdrm
    pkgs.gdk-pixbuf
    pkgs.cairo
    pkgs.pango
    pkgs.dbus
    pkgs.alsa-lib
    pkgs.cups
    pkgs.atk
    pkgs.nspr
    pkgs.nss
    pkgs.glib
  ];
}
