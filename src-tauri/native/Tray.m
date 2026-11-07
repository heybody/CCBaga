// [INPUT]: Rust 托盘菜单传入的 UTF-8 行首文字。
// [OUTPUT]: 按系统菜单字体量出的文字宽度与默认制表位间隔（pt），供菜单行用制表符对齐额度列。
// [POS]: macOS 托盘菜单排版桥；只做测量，不创建、不修改菜单。
// [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
#import <AppKit/AppKit.h>

double ccd_menu_text_width(const char *utf8) {
    @autoreleasepool {
        NSString *text = utf8 ? [NSString stringWithUTF8String:utf8] : nil;
        if (text.length == 0) return 0;
        NSDictionary *attributes = @{NSFontAttributeName: [NSFont menuFontOfSize:0]};
        return ceil([text sizeWithAttributes:attributes].width);
    }
}

double ccd_menu_tab_interval(void) {
    NSParagraphStyle *style = [NSParagraphStyle defaultParagraphStyle];
    if (style.defaultTabInterval > 0) return style.defaultTabInterval;
    NSArray<NSTextTab *> *stops = style.tabStops;
    if (stops.count >= 2) return stops[1].location - stops[0].location;
    if (stops.count == 1 && stops[0].location > 0) return stops[0].location;
    return 28;
}
