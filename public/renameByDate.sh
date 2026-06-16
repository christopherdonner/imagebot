for file in ./img/*; do
    if [ -f "$file" ]; then # Ensures it's a file and not a directory
        mv -n "$file" "$(date -r "$file" +'%Y-%m-%d_%H%M%S')-$file"
    fi
done