import zlib from "node:zlib";
import fs from "node:fs";

function createZip(entries: Array<{ name: string; content: string }>): Buffer {
  const localHeaders: Buffer[] = [];
  const centralHeaders: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "utf8");
    const rawData = Buffer.from(entry.content, "utf8");
    const compressed = zlib.deflateRawSync(rawData);
    const local = Buffer.alloc(30 + nameBuf.length + compressed.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(0, 10);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(rawData.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    nameBuf.copy(local, 30);
    compressed.copy(local, 30 + nameBuf.length);
    localHeaders.push(local);

    const central = Buffer.alloc(46 + nameBuf.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(0, 12);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(rawData.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    nameBuf.copy(central, 46);
    centralHeaders.push(central);
    offset += local.length;
  }
  const centralOffset = offset;
  const centralSize = centralHeaders.reduce((acc, b) => acc + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(centralOffset, 16);
  eocd.writeUInt16LE(0, 20);
  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

const zipBuf = createZip([
  { name: "student.h", content: "typedef struct { char name[32]; int grade; } Student;\nvoid print_student(const Student *s);\n" },
  { name: "student.c", content: "#include <stdio.h>\n#include \"student.h\"\nvoid print_student(const Student *s) {\n    printf(\"Student: %s, Grade: %d\\n\", s->name, s->grade);\n}\n" },
  { name: "main.c", content: "#include <stdio.h>\n#include <string.h>\n#include \"student.h\"\nint main(void) {\n    Student s;\n    strncpy(s.name, \"Charlie\", sizeof(s.name));\n    s.grade = 100;\n    print_student(&s);\n    return 0;\n}\n" }
]);

fs.writeFileSync("c-project.zip", zipBuf);
console.log("Created c-project.zip successfully");
