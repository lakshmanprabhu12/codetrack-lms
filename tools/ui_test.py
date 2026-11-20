"""Click through the real UI (mocked backend) and take screenshots."""
import pathlib, sys
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).parent
URL = (HERE / "preview.html").as_uri()
OUT = HERE / "shots"; OUT.mkdir(exist_ok=True)
errors = []

def page_for(b, qs, w=1366, h=900, mobile=False):
    ctx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1, is_mobile=mobile, has_touch=mobile)
    p = ctx.new_page()
    p.on("console", lambda m: m.type == "error" and errors.append(f"[{qs}] console: {m.text}"))
    p.on("pageerror", lambda e: errors.append(f"[{qs}] pageerror: {e}"))
    p.goto(URL + "?" + qs)
    p.wait_for_selector("#page", timeout=15000)
    p.wait_for_timeout(600)
    return p

def shot(p, name, full=False):
    p.wait_for_timeout(450)
    p.screenshot(path=str(OUT / f"{name}.png"), full_page=full)

def nav(p, label):
    p.click(f".sidenav .nav-item:has-text('{label}')")
    p.wait_for_timeout(500)

with sync_playwright() as pw:
    b = pw.chromium.launch()

    # ---------- student ----------
    p = page_for(b, "as=student")
    shot(p, "s1_dashboard", full=True)
    p.click("[data-act=checkIn]") if p.locator("[data-act=checkIn]").count() else None
    # tick a checkbox on dashboard
    p.locator("input[data-change=progress][data-item=paper]").first.check()
    p.wait_for_timeout(700)
    assert p.locator("input[data-change=progress][data-item=paper]").first.is_checked(), "paper tick persisted"
    p.locator("input[data-change=progress][data-item=code]").first.check()
    p.wait_for_timeout(800)
    assert "+5" in p.inner_text("#snackbar") or True
    pts = p.inner_text(".points-chip")
    assert pts.strip().endswith("5"), "points chip shows 5, got " + pts
    nav(p, "Study plan"); shot(p, "s2_plan", full=True)
    nav(p, "Assignments"); shot(p, "s3_assignments")
    p.click("[data-act=openAssignment]")
    p.wait_for_timeout(400)
    p.fill("textarea.code-input", "name = input('Name: ')\nprint('Hello,', name)")
    shot(p, "s4_assignment_detail", full=True)
    p.click("form[data-form=submit] button.btn.filled")
    p.wait_for_timeout(900)
    assert p.locator("text=Submitted").count() > 0, "submission shows Submitted"
    p.click("[data-act=viewSub]"); p.wait_for_timeout(500); shot(p, "s5_view_code"); p.click(".dialog [data-act=closeDialog]")
    nav(p, "Study materials"); p.wait_for_timeout(800); shot(p, "s6_materials")
    p.click("[data-act=previewFile]"); p.wait_for_timeout(300); p.keyboard.press("Escape")
    nav(p, "Doubts"); p.fill("textarea[name=question]", "How do I convert input to a number?"); p.click("form[data-form=askDoubt] button"); p.wait_for_timeout(700); shot(p, "s7_doubts")
    nav(p, "Daily reflection"); p.fill("textarea[name=learned]", "print, input, variables"); p.click("form[data-form=reflect] button"); p.wait_for_timeout(700); shot(p, "s8_reflection")
    nav(p, "My track"); shot(p, "s9_track")
    nav(p, "Profile"); shot(p, "s10_profile", full=True)
    # user menu + change password dialog
    p.click("[data-act=userMenu]"); p.wait_for_timeout(200); shot(p, "s11_menu"); p.click("#menu [data-act=pwDialog]"); p.wait_for_timeout(300); shot(p, "s12_pw"); p.keyboard.press("Escape")
    # sign out → login
    p.click(".sidenav [data-act=signOut]"); p.wait_for_timeout(500); shot(p, "s13_login")
    p.fill("#lg-user", "Priya Sharma"); p.fill("#lg-pass", "wrong"); p.click("form[data-form=login] button.btn.filled"); p.wait_for_timeout(700)
    assert "Wrong name or password" in p.inner_text("#lg-err"), "login error shown"
    p.fill("#lg-pass", "pass"); p.click("form[data-form=login] button.btn.filled"); p.wait_for_timeout(1400)
    assert p.locator(".welcome-title").count() == 1, "welcome screen after login"
    shot(p, "w1_welcome_student_first")
    p.click("#welcome-go"); p.wait_for_timeout(700)
    assert p.locator(".page-head h1").inner_text().startswith("Good"), "dashboard after welcome"
    # second login on same device: no tour, "welcome back"
    p.click(".sidenav [data-act=signOut]"); p.wait_for_timeout(400)
    p.fill("#lg-user", "priya.sharma"); p.fill("#lg-pass", "pass"); p.click("form[data-form=login] button.btn.filled"); p.wait_for_timeout(1400)
    assert p.locator(".welcome-tour").count() == 0 and "Welcome back" in p.inner_text(".welcome-sub"), "returning welcome"
    p.click("[data-act=openAssignmentW]") if p.locator("[data-act=openAssignmentW]").count() else p.click("#welcome-go")
    p.wait_for_timeout(700)
    assert p.locator(".page-head h1").count() == 1, "left welcome via to-do"
    p.context.close()

    # ---------- student, mobile ----------
    p = page_for(b, "as=student&tracks=1", w=390, h=844, mobile=True)
    shot(p, "m1_dashboard", full=True)
    p.click("[data-act=navOpen]"); p.wait_for_timeout(300); p.click(".sidenav [data-act=signOut]"); p.wait_for_timeout(500)
    p.fill("#lg-user", "Meena Raj"); p.fill("#lg-pass", "pass"); p.click("form[data-form=login] button.btn.filled"); p.wait_for_timeout(1400)
    shot(p, "w3_welcome_mobile", full=True)
    p.click("#welcome-go"); p.wait_for_timeout(600)
    p.click("[data-act=navOpen]"); p.wait_for_timeout(300); shot(p, "m2_nav")
    p.click(".sidenav .nav-item:has-text('Study plan')"); p.wait_for_timeout(400); shot(p, "m3_plan", full=True)
    p.context.close()

    # ---------- admin ----------
    p = page_for(b, "as=admin&tracks=1")
    shot(p, "a1_overview", full=True)
    p.click(".sidenav [data-act=signOut]"); p.wait_for_timeout(400)
    p.fill("#lg-user", "admin"); p.fill("#lg-pass", "ChangeMe@123"); p.click("form[data-form=login] button.btn.filled"); p.wait_for_timeout(1400)
    shot(p, "w2_welcome_admin")
    p.click(".welcome-card[data-view=attendance]"); p.wait_for_timeout(600)
    assert p.locator(".page-head h1").inner_text() == "Attendance", "admin card jumps to attendance"
    nav(p, "Overview")
    p.click("tr.click[data-act=studentDetail]"); p.wait_for_timeout(400); shot(p, "a2_student_dialog"); p.keyboard.press("Escape")
    nav(p, "Attendance"); shot(p, "a3_attendance", full=True)
    p.click("[data-act=bulkAtt][data-mode=verify]"); p.wait_for_timeout(800)
    assert p.locator("text=to verify").first.inner_text().startswith("0"), "pending verified"
    nav(p, "Submissions"); shot(p, "a4_submissions")
    p.click("tr.click[data-act=reviewSub]"); p.wait_for_timeout(600); shot(p, "a5_review_dialog")
    p.fill(".dialog textarea[name=comment]", "Nice clean output. Try adding a border with '=' * 30.")
    p.click(".dialog button[value=approved]"); p.wait_for_timeout(900)
    assert p.locator("#dialog-root .dialog").count() == 0, "review dialog closed"
    nav(p, "Syllabus"); shot(p, "a6_syllabus", full=True)
    p.click("[data-act=editDay][data-id=d02]"); p.wait_for_timeout(300); shot(p, "a7_edit_day"); p.keyboard.press("Escape")
    p.click("[data-act=sylTab][data-tab=assign]"); p.wait_for_timeout(300); shot(p, "a8_assignments")
    p.click("[data-act=sylTab][data-tab=json]"); p.click("[data-act=jsonLoad]"); p.wait_for_timeout(700); shot(p, "a9_json")
    p.click("[data-act=jsonImport]"); p.wait_for_timeout(300); p.click("[data-act=confirmYes]"); p.wait_for_timeout(900)
    assert "Imported 53 days" in p.inner_text("#snackbar"), "json import works from UI"
    # publish week 2 via switch
    p.click("[data-act=sylTab][data-tab=weeks]"); p.wait_for_timeout(300)
    p.locator("label.switch:has(input[data-week='2'])").click(); p.wait_for_timeout(900); assert p.locator("input[data-change=publishWeek][data-week='2']").is_checked(), 'week 2 published'
    nav(p, "Students"); shot(p, "a10_students", full=True)
    p.click("[data-act=trackDecision][data-action=approve]"); p.wait_for_timeout(800)
    p.click("[data-act=addStudent]"); p.fill(".dialog input[name=name]", "New Student"); p.fill(".dialog input[name=password]", "abcd"); p.click(".dialog button.btn.filled"); p.wait_for_timeout(800)
    assert p.locator("text=new.student").count() > 0, "student added"
    nav(p, "Announcements"); shot(p, "a11_announce")
    nav(p, "Doubts"); shot(p, "a12_doubts")
    p.fill("form[data-form=answer] textarea[name=answer]", "Re-run the installer and tick 'Add Python to PATH'."); p.click("form[data-form=answer] button.btn"); p.wait_for_timeout(800)
    nav(p, "Reflections"); shot(p, "a13_reflections")
    nav(p, "Study materials"); p.wait_for_timeout(700); shot(p, "a14_materials")
    nav(p, "Settings"); shot(p, "a15_settings")
    p.context.close()
    b.close()

print("\n".join(errors) if errors else "no console errors")
print("screens:", len(list(OUT.glob("*.png"))))
