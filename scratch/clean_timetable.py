import re

file_path = r'd:\college-planner-timetable-system\src\app\timetable-component\timetable-component.ts'
with open(file_path, 'r') as f:
    content = f.read()

# Replacement function for the messy findLabSubstitute
clean_sub = """    const findLabSubstitute = (day: string, timeLabel: string, schedule: any[], sem: number) => {
      return this.staffList().find(st => {
        if (st.name?.toLowerCase().includes('snehal joshi')) return false;
        const primarySub = this.allSubjects().find(s => s.divisionStaff?.A === st.id || s.divisionStaff?.B === st.id || s.divisionStaff?.C === st.id);
        const dept = (primarySub?.department || '').toUpperCase().trim();
        const restricted = ['MATHEMATICS', 'MATHS', 'AEC', 'VAC', 'SEC', 'COMMUNICATIONS', 'COMM', 'ENGLISH'];
        return !restricted.includes(dept) && !isStaffBusy(st.id, day, timeLabel, schedule, sem, 'Lab');
      });
    };"""

# Use regex to find the messy block (start with const findLabSubstitute and end with its closing brace)
# Since the messy block is nested, we need careful matching.
# But we know it starts with 'const findLabSubstitute' and ends with '    };'

pattern = r'const findLabSubstitute = \(day: string, timeLabel: string, schedule: any\[\], sem: number\) => \{ .*?    \};'
processed = re.sub(pattern, clean_sub, content, flags=re.DOTALL)

with open(file_path, 'w') as f:
    f.write(processed)
