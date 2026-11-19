import os

replacements = {
    'Vocalyze AI': 'VakSutra AI',
    'Vocalyze': 'VakSutra',
    'vocalyze:': 'vaksutra:',
}

target_dirs = ['.', 'src', 'public']
files_to_process = []
for d in target_dirs:
    for root, dirs, files in os.walk(d):
        if 'node_modules' in root or '.next' in root:
            continue
        for file in files:
            if file.endswith(('.tsx', '.ts', '.md', '.html', '.css', '.json')):
                files_to_process.append(os.path.join(root, file))

# Deduplicate
files_to_process = list(set(files_to_process))

for filepath in files_to_process:
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        original_content = content
        for old, new in replacements.items():
            content = content.replace(old, new)
            
        if content != original_content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f'Updated {filepath}')
    except Exception as e:
        pass

print("Renaming completed successfully!")
