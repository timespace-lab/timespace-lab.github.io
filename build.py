import glob,sys
css=open('src/base.css',encoding='utf8').read()+open('src/added.css',encoding='utf8').read()
js='\n'.join(open(f,encoding='utf8').read() for f in sorted(glob.glob('src/[0-9]-*.js')))
html=f'''<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="description" content="시공간 LAB · 학생이 시간과 공간을 연결해 지도와 연표로 탐구 기록을 만드는 웹앱">
<title>시공간 LAB</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css" crossorigin="anonymous" referrerpolicy="no-referrer">
<style>
{css}</style>
<!-- 선택: 같은 폴더의 config.js 에서 window.SIGONGGAN_CONFIG = {{ supabaseUrl, supabaseKey }} 를 정할 수 있어요. 없으면 무시돼요. -->
<script src="config.js" onerror="void 0"></script>
</head>
<body>
<div id="root"></div>
<noscript>시공간 LAB은 자바스크립트를 켜야 쓸 수 있어요.</noscript>
<script>
{js}
init();
</script>
</body>
</html>
'''
open('dist/index.html','w',encoding='utf8').write(html)
print(len(html))
