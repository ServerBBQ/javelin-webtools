import Image from "next/image";
import path from 'path';
import fs from 'fs';
import Link from "next/link";
import nextConfig from "@/next.config";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface Tool {
  name: string;
  folder: string;
  link: string;
  description?: string;
  icon?: string | React.ElementType;
  author?: string;
}

// Only needed for images
const basePath = nextConfig.basePath || "/";

export default function ToolsPage() {
  const toolsPath = path.join(process.cwd(), 'app', 'tools');
  const entries = fs.readdirSync(toolsPath, { withFileTypes: true });

  const tools: Tool[] = entries
    .filter(entry => entry.isDirectory())
    .map(folder => {
      const folderPath = path.join(toolsPath, folder.name);

      // Read metadata.json if exists
      let metadata: Partial<Tool> = {};
      const metadataPath = path.join(folderPath, 'metadata.json');
      if (fs.existsSync(metadataPath)) {
        const raw = fs.readFileSync(metadataPath, 'utf-8');
        metadata = JSON.parse(raw);
      }

      // Default icon if exists
      const iconPath = path.join(folderPath, 'icon.png');
      if (!metadata.icon && fs.existsSync(iconPath)) {
        metadata.icon = `/tools/${folder.name}/icon.png`;
      }

      if (!metadata.name) metadata.name = folder.name;

      metadata.folder = folder.name;
      metadata.link = `/tools/${metadata.folder}`

      return metadata as Tool;
    });

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4 text-center">3rd Party Javelin Web Tools</h1>
        <div className="grid grid-cols-[repeat(auto-fit,250px)] gap-6 p-6">
        {tools.map((tool) => (
          <Link
            key={tool.name}
            href={tool.link}
            className="group block border rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
          >
            <Card className="flex flex-col h-[250px]">
              <CardContent className="flex-1 flex flex-col items-center justify-center">
                {tool.icon? (
                  <Image
                    src={basePath + tool.icon}
                    alt={`${tool.name} icon`}
                    width={64}
                    height={64}
                    className="mt-2"
                  />
                ) : null}
              </CardContent>

              <CardHeader className="">
                <CardTitle>{tool.name}</CardTitle>
                  {tool.description || tool.author ? (
                    <CardDescription>
                      {tool.description}
                      {tool.description && tool.author && (<br/>)}
                      {tool.author && <span className="text-gray-500">By {tool.author}</span>}
                    </CardDescription>
                  ) : null}
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}