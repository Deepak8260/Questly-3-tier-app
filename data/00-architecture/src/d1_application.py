from archlib import Diagram

d = Diagram("01-application-architecture", 1370, 720, "Application Architecture",
            "Three tiers: Next.js frontend, Express API, Supabase data. Gemini generates the quizzes.")


d.card(80, 350, 220, 150, "ui:world", "Browser", "React pages")
d.card(470, 190, 280, 150, ["brand:nextdotjs", "brand:react"], "Frontend", "Next.js 16 · :3000",
       tag="TIER 1", tag_colour="ink")
d.card(470, 520, 280, 150, ["brand:express", "brand:nodedotjs"], "Backend API", "Express 5 · :3001",
       tag="TIER 2", tag_colour="green")
d.card(1010, 190, 300, 150, ["brand:supabase", "brand:postgresql"], "Supabase", "Auth · Postgres · Realtime",
       tag="TIER 3", tag_colour="teal")
d.card(1010, 520, 300, 150, "brand:googlegemini", "Gemini API", "Quiz generation")

d.edge([(300, 395), (385, 395), (385, 265), (468, 265)], "blue", "pages", at=(385, 330))
d.edge([(300, 455), (385, 455), (385, 595), (468, 595)], "orange", "/api/quiz/*", at=(385, 525))
d.edge([(750, 265), (1008, 265)], "green", "session check", dashed=True)
d.edge([(750, 595), (880, 595), (880, 300), (1008, 300)], "green", "save score · service_role", at=(880, 450))
d.edge([(750, 625), (1008, 625)], "purple", "generate quiz", at=(880, 625))
d.edge([(190, 350), (190, 120), (1160, 120), (1160, 188)], "green", "login · data · live updates · anon key",
       at=(675, 120))

d.render()
