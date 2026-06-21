"""
Patch the AWS sample AgentCore studio for region portability.
Applied by deploy-studio.sh before cdk deploy.

Changes:
1. Makes CLOUDFRONT-scoped WAF conditional on us-east-1 (fails in other regions)
2. Adds portal_origin context support for CSP frame-ancestors
3. Removes X-Frame-Options when portal_origin is set (can't cross-origin frame with XFO)
"""
import re
import sys
import os

def patch_platform_stack(filepath):
    """Patch infra/stacks/platform_stack.py"""
    with open(filepath, "r") as f:
        content = f.read()

    # Already patched?
    if "portal_origin" in content and "self.region ==" in content:
        print(f"  {filepath}: already patched, skipping")
        return

    # 1. Add portal_origin to __init__ signature
    # Find: def __init__(self, scope, id, *, ...):
    init_pattern = r'(def __init__\(self,\s*scope[^)]*)\)\s*:'
    match = re.search(init_pattern, content)
    if match:
        # Add portal_origin param if not present
        if "portal_origin" not in match.group(0):
            old_sig = match.group(0)
            new_sig = old_sig.replace("):", ', portal_origin: str = ""):')
            content = content.replace(old_sig, new_sig)
            # Add self._portal_origin after super().__init__ or first self. assignment
            super_pattern = r'(super\(\).__init__\([^)]*\))'
            super_match = re.search(super_pattern, content)
            if super_match:
                insert_after = super_match.end()
                content = content[:insert_after] + '\n        self._portal_origin = (portal_origin or "").strip()' + content[insert_after:]

    # 2. Make WAF conditional on us-east-1
    # Find: self.web_acl = self._create_waf_web_acl()
    waf_pattern = r'(self\.web_acl\s*=\s*self\._create_waf_web_acl\(\))'
    if re.search(waf_pattern, content):
        content = re.sub(
            waf_pattern,
            'self.web_acl = self._create_waf_web_acl() if self.region == "us-east-1" else None',
            content
        )

    # 3. Make web_acl_id conditional in CloudFront distribution
    # Find: web_acl_id=self.web_acl.attr_arn or similar
    waf_id_pattern = r'web_acl_id\s*=\s*self\.web_acl\.attr_arn'
    if re.search(waf_id_pattern, content):
        content = re.sub(
            waf_id_pattern,
            'web_acl_id=(self.web_acl.attr_arn if self.web_acl else None)',
            content
        )

    # 4. Modify frame-ancestors in CSP if portal_origin is set
    # Find the content_security_policy string that has frame-ancestors
    fa_pattern = r"(frame-ancestors\s+'none')"
    if re.search(fa_pattern, content):
        # Replace with conditional based on self._portal_origin
        content = re.sub(
            fa_pattern,
            "frame-ancestors 'self' \" + (self._portal_origin if hasattr(self, '_portal_origin') and self._portal_origin else \"'none'\") + \"",
            content
        )

    # 5. Make X-Frame-Options conditional (remove when portal_origin set)
    # Look for frame_options or FrameOptions references and wrap
    xfo_pattern = r'(frame_options\s*=.*)'
    for m in re.finditer(xfo_pattern, content):
        line = m.group(0)
        if "None" not in line and "portal_origin" not in line:
            indent = " " * (m.start() - content.rfind("\n", 0, m.start()) - 1)
            new_line = f'frame_options=(None if hasattr(self, "_portal_origin") and self._portal_origin else cloudfront.ResponseHeadersFrameOptions(frame_option=cloudfront.HeadersFrameOption.DENY, override=True)),'
            content = content.replace(line, new_line)
            break

    with open(filepath, "w") as f:
        f.write(content)
    print(f"  {filepath}: patched (WAF conditional, portal_origin, frame headers)")


def patch_app_py(filepath, portal_origin=""):
    """Patch infra/app.py to pass portal_origin context"""
    with open(filepath, "r") as f:
        content = f.read()

    if "portal_origin" in content:
        print(f"  {filepath}: already has portal_origin, skipping")
        return

    # Find where PlatformStack is instantiated and add portal_origin
    stack_pattern = r'(PlatformStack\([^)]*)\)'
    match = re.search(stack_pattern, content, re.DOTALL)
    if match:
        old = match.group(0)
        # Add portal_origin param
        insert = old.rstrip(")")
        insert += ',\n    portal_origin=app.node.try_get_context("portal_origin") or "")'
        content = content.replace(old, insert)

    with open(filepath, "w") as f:
        f.write(content)
    print(f"  {filepath}: patched (portal_origin context)")


if __name__ == "__main__":
    base_dir = sys.argv[1] if len(sys.argv) > 1 else "."

    platform_stack = os.path.join(base_dir, "infra", "stacks", "platform_stack.py")
    app_py = os.path.join(base_dir, "infra", "app.py")

    print("Patching studio for region portability...")

    if os.path.exists(platform_stack):
        patch_platform_stack(platform_stack)
    else:
        print(f"  WARNING: {platform_stack} not found")

    if os.path.exists(app_py):
        patch_app_py(app_py)
    else:
        print(f"  WARNING: {app_py} not found")

    print("Done.")
